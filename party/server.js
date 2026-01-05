// PartyKit Server for Skull Board Game
// Handles all game logic and state management

// Color codes c01-c06 for 6 players
const COLOR_CODES = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06'];

// Fisher-Yates shuffle
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default class SkullServer {
    constructor(room) {
        this.room = room;
        this.gameState = this.createInitialState();
    }

    createInitialState() {
        return {
            players: [],
            phase: 'LOBBY', // LOBBY, PLACEMENT, CHALLENGE, REVELATION, CARD_LOSS
            hostId: null,
            currentTurnId: null, // Who needs to act
            firstPlayerId: null, // First player of the round
            challengerId: null, // Who initiated/won the challenge
            currentBid: 0,
            revealedCount: 0,
            revealedSkull: false,
            skullOwnerId: null, // Who owned the skull that was revealed
            passedPlayers: [], // Players who passed on bidding
            gameStarted: false,
            placementRound: 1, // Track which round of placement (1 = initial, 2+ = adding)
            cardLossProcessed: false, // Prevent spam during card loss
            turnTimerDuration: 0,
            turnDeadline: null
        };
    }

    onConnect(connection, ctx) {
        // Send current state to newly connected player
        connection.send(JSON.stringify({
            type: 'state',
            state: this.getSanitizedState()
        }));
    }

    onMessage(message, sender) {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    this.handleJoin(data, sender);
                    break;
                case 'leave':
                    this.handleLeave(sender);
                    break;
                case 'start':
                    this.handleStart(data, sender);
                    break;
                case 'placeCard':
                    this.handlePlaceCard(data, sender);
                    break;
                case 'challenge':
                    this.handleChallenge(data, sender);
                    break;
                case 'raise':
                    this.handleRaise(data, sender);
                    break;
                case 'pass':
                    this.handlePass(sender);
                    break;
                case 'reveal':
                    this.handleReveal(data, sender);
                    break;
                case 'selectCardLoss':
                    this.handleCardLoss(data, sender);
                    break;
                case 'chooseFirstPlayer':
                    this.handleChooseFirstPlayer(data, sender);
                    break;
                case 'reset':
                    this.handleReset(sender);
                    break;
                case 'ping':
                    sender.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (e) {
            console.error('Message parse error:', e);
        }
    }

    onClose(connection) {
        this.handleLeave(connection);
    }

    // === HANDLERS ===

    handleJoin(data, sender) {
        if (this.gameState.gameStarted) {
            sender.send(JSON.stringify({ type: 'error', message: 'Game already started' }));
            return;
        }

        if (this.gameState.players.length >= 6) {
            sender.send(JSON.stringify({ type: 'error', message: 'Room is full (max 6 players)' }));
            return;
        }

        const existingPlayer = this.gameState.players.find(p => p.id === sender.id);

        // Check if this is a new player trying to join a non-existent room
        // If isCreator flag is not set and room has no players, it means someone
        // is trying to join with an invalid room code
        if (!existingPlayer && this.gameState.players.length === 0 && !data.isCreator) {
            sender.send(JSON.stringify({
                type: 'error',
                message: 'Room not found. Please check the room code and try again.'
            }));
            return;
        }

        if (!existingPlayer) {
            const colorIndex = this.gameState.players.length;
            const player = {
                id: sender.id,
                name: data.name,
                colorCode: COLOR_CODES[colorIndex], // c01, c02, etc.
                // Cards: 3 flowers + 1 skull
                hand: ['flower', 'flower', 'flower', 'skull'],
                stack: [], // Cards placed on mat (face down)
                wins: 0, // Successful challenges
                eliminated: false
            };
            this.gameState.players.push(player);
        }

        if (this.gameState.players.length === 1) {
            this.gameState.hostId = sender.id;
        }

        this.broadcast({
            type: 'playerJoined',
            player: this.gameState.players.find(p => p.id === sender.id),
            hostId: this.gameState.hostId,
            players: this.getSanitizedPlayers()
        });
    }

    handleLeave(sender) {
        const index = this.gameState.players.findIndex(p => p.id === sender.id);
        if (index !== -1) {
            this.gameState.players.splice(index, 1);

            // Transfer host if needed
            if (this.gameState.hostId === sender.id && this.gameState.players.length > 0) {
                this.gameState.hostId = this.gameState.players[0].id;
            }

            this.broadcast({
                type: 'playerLeft',
                playerId: sender.id,
                hostId: this.gameState.hostId,
                players: this.getSanitizedPlayers()
            });
        }
    }

    handleStart(data, sender) {
        if (sender.id !== this.gameState.hostId) return;
        if (this.gameState.players.length < 3) {
            sender.send(JSON.stringify({ type: 'error', message: 'Need at least 3 players' }));
            return;
        }

        this.gameState.gameStarted = true;
        this.gameState.turnTimerDuration = data.timerDuration || 0;

        // Random first player
        const activePlayers = this.gameState.players.filter(p => !p.eliminated);
        const randomIndex = Math.floor(Math.random() * activePlayers.length);
        this.gameState.firstPlayerId = activePlayers[randomIndex].id;

        this.startNewRound();

        this.broadcast({
            type: 'gameStarted',
            state: this.getSanitizedState()
        });
    }

    startNewRound() {
        // Reset for new round
        this.gameState.phase = 'PLACEMENT';
        this.gameState.currentBid = 0;
        this.gameState.revealedCount = 0;
        this.gameState.revealedSkull = false;
        this.gameState.skullOwnerId = null;
        this.gameState.passedPlayers = [];
        this.gameState.challengerId = null;
        this.gameState.placementRound = 1;
        this.gameState.cardLossProcessed = false;

        // Return cards from stack to hand for all players
        this.gameState.players.forEach(p => {
            if (!p.eliminated) {
                // Combine hand and stack back
                p.hand = [...p.hand, ...p.stack.map(c => c.type)];
                p.stack = [];
            }
        });

        // Make sure first player is not eliminated
        const firstPlayer = this.gameState.players.find(p => p.id === this.gameState.firstPlayerId);
        if (!firstPlayer || firstPlayer.eliminated) {
            this.gameState.firstPlayerId = this.getFirstActivePlayer().id;
        }

        this.gameState.currentTurnId = this.gameState.firstPlayerId;
        this.startTurnTimer();
    }

    handlePlaceCard(data, sender) {
        if (this.gameState.phase !== 'PLACEMENT') return;
        if (this.gameState.currentTurnId !== sender.id) return;

        const player = this.gameState.players.find(p => p.id === sender.id);
        if (!player || player.eliminated) return;

        const cardType = data.cardType; // 'flower' or 'skull'
        const cardIndex = player.hand.indexOf(cardType);
        if (cardIndex === -1) return;

        // Remove from hand and add to stack (on top)
        player.hand.splice(cardIndex, 1);
        player.stack.push({ type: cardType, revealed: false });

        // Check if this completes the initial placement round
        const activePlayers = this.gameState.players.filter(p => !p.eliminated);
        const allPlayersPlacedOnce = activePlayers.every(p => p.stack.length >= 1);

        // Move to next player
        const nextPlayer = this.getNextActivePlayer(sender.id);
        this.gameState.currentTurnId = nextPlayer.id;

        // If we've completed the initial round, go back to first player for add/challenge
        if (allPlayersPlacedOnce && this.gameState.placementRound === 1) {
            this.gameState.placementRound = 2;
            this.gameState.currentTurnId = this.gameState.firstPlayerId;
        }

        this.broadcast({
            type: 'cardPlaced',
            playerId: sender.id,
            stackSize: player.stack.length,
            currentTurnId: this.gameState.currentTurnId,
            phase: this.gameState.phase,
            placementRound: this.gameState.placementRound,
            players: this.getSanitizedPlayers(),
            // Notify if current player has only 1 card and must challenge
            mustChallenge: this.gameState.placementRound >= 2 &&
                this.gameState.currentTurnId === sender.id &&
                player.hand.length === 0
        });

        this.startTurnTimer();
    }

    handleChallenge(data, sender) {
        if (this.gameState.phase !== 'PLACEMENT') return;
        if (this.gameState.currentTurnId !== sender.id) return;

        const player = this.gameState.players.find(p => p.id === sender.id);
        if (!player || player.eliminated) return;

        // Must have at least 1 disc on stack to challenge
        if (player.stack.length === 0) {
            sender.send(JSON.stringify({ type: 'error', message: 'You must place at least 1 disc before challenging' }));
            return;
        }

        // Check if everyone has placed at least one disc
        const activePlayers = this.gameState.players.filter(p => !p.eliminated);
        const allPlaced = activePlayers.every(p => p.stack.length > 0);
        if (!allPlaced) {
            sender.send(JSON.stringify({ type: 'error', message: 'All players must place at least 1 disc first' }));
            return;
        }

        // Validate bid is specified (must be at least 1)
        const bid = data.bid;
        if (!bid || bid < 1) {
            sender.send(JSON.stringify({ type: 'error', message: 'You must specify a bid amount' }));
            return;
        }
        const totalCards = this.getTotalCardsOnTable();

        if (bid < 1 || bid > totalCards) {
            sender.send(JSON.stringify({ type: 'error', message: 'Invalid bid' }));
            return;
        }

        this.gameState.phase = 'CHALLENGE';
        this.gameState.challengerId = sender.id;
        this.gameState.currentBid = bid;
        this.gameState.passedPlayers = [];

        // Next player must respond
        this.gameState.currentTurnId = this.getNextActivePlayer(sender.id).id;

        this.broadcast({
            type: 'challengeStarted',
            challengerId: sender.id,
            bid: bid,
            currentTurnId: this.gameState.currentTurnId,
            phase: this.gameState.phase,
            totalCards: totalCards
        });

        // Auto-start revelation if max bid is reached immediately
        if (bid >= totalCards) {
            setTimeout(() => {
                this.startRevelation();
            }, 1000);
        } else {
            this.startTurnTimer();
        }
    }

    handleRaise(data, sender) {
        if (this.gameState.phase !== 'CHALLENGE') return;
        if (this.gameState.currentTurnId !== sender.id) return;
        if (this.gameState.passedPlayers.includes(sender.id)) return;

        const newBid = data.bid;
        const totalCards = this.getTotalCardsOnTable();

        if (newBid <= this.gameState.currentBid || newBid > totalCards) {
            sender.send(JSON.stringify({ type: 'error', message: 'Bid must be higher than current bid' }));
            return;
        }

        this.gameState.currentBid = newBid;
        this.gameState.challengerId = sender.id;

        // Move to next non-passed player
        this.gameState.currentTurnId = this.getNextBiddingPlayer(sender.id).id;

        // Check if only one player remains (all others passed)
        if (this.checkBiddingComplete()) {
            this.startRevelation();
        } else if (newBid >= totalCards) {
            // Auto-start revelation if max bid is reached
            this.broadcast({
                type: 'bidRaised',
                playerId: sender.id,
                bid: newBid,
                currentTurnId: this.gameState.currentTurnId,
                challengerId: this.gameState.challengerId
            });
            // Small delay to let the bid update show before switching phase
            setTimeout(() => {
                this.startRevelation();
            }, 1000);
        } else {
            this.broadcast({
                type: 'bidRaised',
                playerId: sender.id,
                bid: newBid,
                currentTurnId: this.gameState.currentTurnId,
                challengerId: this.gameState.challengerId
            });
            this.startTurnTimer();
        }
    }

    handlePass(sender) {
        if (this.gameState.phase !== 'CHALLENGE') return;
        if (this.gameState.currentTurnId !== sender.id) return;
        if (this.gameState.passedPlayers.includes(sender.id)) return;

        this.gameState.passedPlayers.push(sender.id);

        // Move to next non-passed player
        const nextPlayer = this.getNextBiddingPlayer(sender.id);
        this.gameState.currentTurnId = nextPlayer.id;

        // Check if only one player remains
        if (this.checkBiddingComplete()) {
            this.startRevelation();
        } else {
            this.broadcast({
                type: 'playerPassed',
                playerId: sender.id,
                passedPlayers: this.gameState.passedPlayers,
                currentTurnId: this.gameState.currentTurnId
            });
            this.startTurnTimer();
        }
    }

    checkBiddingComplete() {
        const activePlayers = this.gameState.players.filter(p => !p.eliminated);
        const nonPassedPlayers = activePlayers.filter(p => !this.gameState.passedPlayers.includes(p.id));
        return nonPassedPlayers.length === 1;
    }

    startRevelation() {
        this.gameState.phase = 'REVELATION';
        this.gameState.revealedCount = 0;
        this.gameState.revealedSkull = false;
        this.gameState.currentTurnId = this.gameState.challengerId;

        this.broadcast({
            type: 'revelationStarted',
            challengerId: this.gameState.challengerId,
            bid: this.gameState.currentBid,
            phase: this.gameState.phase,
            players: this.getSanitizedPlayers()
        });
    }

    handleReveal(data, sender) {
        if (this.gameState.phase !== 'REVELATION') return;
        if (sender.id !== this.gameState.challengerId) return;

        const targetPlayerId = data.targetPlayerId;
        const targetPlayer = this.gameState.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer || targetPlayer.eliminated) return;

        // Challenger must reveal their own discs first (all of them)
        const challenger = this.gameState.players.find(p => p.id === sender.id);
        const challengerHiddenCards = challenger.stack.filter(c => !c.revealed).length;

        if (targetPlayerId !== sender.id && challengerHiddenCards > 0) {
            sender.send(JSON.stringify({ type: 'error', message: 'You must reveal all your own discs first' }));
            return;
        }

        // Find top unrevealed disc (top = last in array)
        const hiddenCards = targetPlayer.stack.filter(c => !c.revealed);
        if (hiddenCards.length === 0) {
            sender.send(JSON.stringify({ type: 'error', message: 'No discs to reveal' }));
            return;
        }

        // Reveal TOP disc (last unrevealed in stack)
        let topUnrevealedIndex = -1;
        for (let i = targetPlayer.stack.length - 1; i >= 0; i--) {
            if (!targetPlayer.stack[i].revealed) {
                topUnrevealedIndex = i;
                break;
            }
        }

        if (topUnrevealedIndex === -1) return;

        const card = targetPlayer.stack[topUnrevealedIndex];
        card.revealed = true;
        this.gameState.revealedCount++;

        if (card.type === 'skull') {
            // Found skull - challenger loses!
            this.gameState.revealedSkull = true;
            this.gameState.skullOwnerId = targetPlayerId;
            this.handleChallengerLoss();
        } else {
            // Revealed a flower
            // Always broadcast the reveal first
            this.broadcast({
                type: 'cardRevealed',
                targetPlayerId: targetPlayerId,
                cardType: card.type,
                revealedCount: this.gameState.revealedCount,
                bid: this.gameState.currentBid,
                players: this.getSanitizedPlayers()
            });

            if (this.gameState.revealedCount >= this.gameState.currentBid) {
                // Met the bid - challenger wins!
                this.handleChallengerWin();
            }
        }
    }

    handleChallengerWin() {
        const challenger = this.gameState.players.find(p => p.id === this.gameState.challengerId);
        challenger.wins++;

        if (challenger.wins >= 2) {
            // Game over - challenger wins the game!
            this.broadcast({
                type: 'gameOver',
                winnerId: challenger.id,
                winnerName: challenger.name,
                players: this.getSanitizedPlayers()
            });
        } else {
            // Round won, continue game
            // Challenger is first player next round
            this.gameState.firstPlayerId = challenger.id;

            this.broadcast({
                type: 'roundWon',
                winnerId: challenger.id,
                winnerName: challenger.name,
                wins: challenger.wins,
                players: this.getSanitizedPlayers()
            });

            // Start new round after delay
            setTimeout(() => {
                this.startNewRound();
                this.broadcast({
                    type: 'newRound',
                    state: this.getSanitizedState()
                });
            }, 3000);
        }
    }

    handleChallengerLoss() {
        const challenger = this.gameState.players.find(p => p.id === this.gameState.challengerId);

        this.gameState.phase = 'CARD_LOSS';

        if (this.gameState.skullOwnerId === challenger.id) {
            // Revealed own skull - challenger chooses which disc to discard
            this.gameState.currentTurnId = challenger.id;

            this.broadcast({
                type: 'skullRevealed',
                challengerId: challenger.id,
                skullOwnerId: this.gameState.skullOwnerId,
                ownSkull: true,
                phase: this.gameState.phase,
                currentTurnId: this.gameState.currentTurnId,
                players: this.getSanitizedPlayers()
            });
        } else {
            // Someone else's skull - SKULL OWNER chooses which card challenger loses
            // Per rulebook: "The player whose Skull the Challenger flipped chooses the disc to eliminate"
            this.gameState.currentTurnId = this.gameState.skullOwnerId;

            this.broadcast({
                type: 'skullRevealed',
                challengerId: challenger.id,
                skullOwnerId: this.gameState.skullOwnerId,
                ownSkull: false,
                phase: this.gameState.phase,
                currentTurnId: this.gameState.currentTurnId,
                players: this.getSanitizedPlayers()
            });
        }
    }

    handleCardLoss(data, sender) {
        if (this.gameState.phase !== 'CARD_LOSS') return;
        if (sender.id !== this.gameState.currentTurnId) return;
        if (this.gameState.cardLossProcessed) return; // Prevent spam

        const challenger = this.gameState.players.find(p => p.id === this.gameState.challengerId);

        // Determine who is choosing and who is losing
        // If own skull: challenger chooses their own card to lose
        // If opponent skull: skull owner chooses challenger's card to lose
        const isOwnSkull = this.gameState.skullOwnerId === challenger.id;
        const losingPlayer = challenger; // Challenger always loses the card

        if (!losingPlayer) return;

        const cardIndex = data.cardIndex;
        const allCards = [...losingPlayer.hand, ...losingPlayer.stack.map(c => c.type)];

        if (cardIndex < 0 || cardIndex >= allCards.length) return;

        // Mark as processed to prevent spam
        this.gameState.cardLossProcessed = true;

        // Remove the card from the losing player (challenger)
        if (cardIndex < losingPlayer.hand.length) {
            losingPlayer.hand.splice(cardIndex, 1);
        } else {
            const stackIndex = cardIndex - losingPlayer.hand.length;
            losingPlayer.stack.splice(stackIndex, 1);
        }

        // Check if player is eliminated
        const remainingCards = losingPlayer.hand.length + losingPlayer.stack.length;
        if (remainingCards === 0) {
            losingPlayer.eliminated = true;
        }

        this.finishCardLoss(losingPlayer);
    }

    randomCardLoss(player) {
        // Shuffle all cards (hand + stack) and remove one randomly
        const allCards = [...player.hand, ...player.stack.map(c => c.type)];
        const shuffled = shuffleArray(allCards);

        // Remove first card after shuffle (random selection)
        const removedCard = shuffled[0];

        // Find and remove from hand or stack
        const handIndex = player.hand.indexOf(removedCard);
        if (handIndex !== -1) {
            player.hand.splice(handIndex, 1);
        } else {
            const stackIndex = player.stack.findIndex(c => c.type === removedCard);
            if (stackIndex !== -1) {
                player.stack.splice(stackIndex, 1);
            }
        }

        // Check elimination
        const remainingCards = player.hand.length + player.stack.length;
        if (remainingCards === 0) {
            player.eliminated = true;
        }

        this.finishCardLoss(player);
    }

    finishCardLoss(player) {
        // Check if game should end (only 1 player left)
        const activePlayers = this.gameState.players.filter(p => !p.eliminated);

        if (activePlayers.length === 1) {
            // Game over - last player standing wins
            this.broadcast({
                type: 'gameOver',
                winnerId: activePlayers[0].id,
                winnerName: activePlayers[0].name,
                reason: 'lastStanding',
                players: this.getSanitizedPlayers()
            });
            return;
        }

        // Determine next first player
        const challenger = this.gameState.players.find(p => p.id === this.gameState.challengerId);

        if (challenger.eliminated) {
            if (this.gameState.skullOwnerId && this.gameState.skullOwnerId !== challenger.id) {
                // Eliminated by someone else's skull - skull owner goes first
                this.gameState.firstPlayerId = this.gameState.skullOwnerId;
                this.proceedAfterCardLoss(player);
            } else {
                // Eliminated by OWN skull - challenger CHOOSES who goes next (per rulebook)
                this.gameState.phase = 'CHOOSE_FIRST_PLAYER';
                this.gameState.currentTurnId = challenger.id; // Eliminated player still chooses

                this.broadcast({
                    type: 'chooseFirstPlayerPhase',
                    eliminatedPlayerId: challenger.id,
                    phase: this.gameState.phase,
                    currentTurnId: this.gameState.currentTurnId,
                    players: this.getSanitizedPlayers()
                });
            }
        } else {
            // Challenger not eliminated - they go first next round
            this.gameState.firstPlayerId = challenger.id;
            this.proceedAfterCardLoss(player);
        }
    }

    proceedAfterCardLoss(player) {
        this.broadcast({
            type: 'cardLost',
            playerId: player.id,
            eliminated: player.eliminated,
            remainingCards: player.hand.length + player.stack.length,
            players: this.getSanitizedPlayers()
        });

        // Start new round
        setTimeout(() => {
            this.startNewRound();
            this.broadcast({
                type: 'newRound',
                state: this.getSanitizedState()
            });
        }, 2000);
    }

    handleChooseFirstPlayer(data, sender) {
        if (this.gameState.phase !== 'CHOOSE_FIRST_PLAYER') return;
        if (sender.id !== this.gameState.currentTurnId) return;

        const chosenPlayerId = data.playerId;
        const chosenPlayer = this.gameState.players.find(p => p.id === chosenPlayerId);

        // Validate: must be an active (non-eliminated) player
        if (!chosenPlayer || chosenPlayer.eliminated) {
            sender.send(JSON.stringify({ type: 'error', message: 'Invalid player selection' }));
            return;
        }

        this.gameState.firstPlayerId = chosenPlayerId;

        // Find the eliminated challenger for the cardLost broadcast
        const challenger = this.gameState.players.find(p => p.id === this.gameState.challengerId);

        this.broadcast({
            type: 'cardLost',
            playerId: challenger.id,
            eliminated: challenger.eliminated,
            remainingCards: 0,
            chosenFirstPlayerId: chosenPlayerId,
            chosenFirstPlayerName: chosenPlayer.name,
            players: this.getSanitizedPlayers()
        });

        // Start new round
        setTimeout(() => {
            this.startNewRound();
            this.broadcast({
                type: 'newRound',
                state: this.getSanitizedState()
            });
        }, 2000);
    }

    handleReset(sender) {
        if (sender.id !== this.gameState.hostId) return;

        // Reset game state but preserve players
        const existingPlayers = this.gameState.players;
        const hostId = this.gameState.hostId;

        this.gameState = this.createInitialState();
        this.gameState.hostId = hostId;

        // Re-add players with fresh cards
        existingPlayers.forEach((p, index) => {
            this.gameState.players.push({
                id: p.id,
                name: p.name,
                colorCode: COLOR_CODES[index],
                hand: ['flower', 'flower', 'flower', 'skull'],
                stack: [],
                wins: 0,
                eliminated: false
            });
        });

        this.broadcast({
            type: 'gameReset',
            state: this.getSanitizedState()
        });
    }

    // === HELPERS ===

    getFirstActivePlayer() {
        return this.gameState.players.find(p => !p.eliminated);
    }

    getNextActivePlayer(currentId) {
        const players = this.gameState.players;
        const currentIndex = players.findIndex(p => p.id === currentId);

        for (let i = 1; i <= players.length; i++) {
            const nextIndex = (currentIndex + i) % players.length;
            if (!players[nextIndex].eliminated) {
                return players[nextIndex];
            }
        }
        return players[currentIndex];
    }

    getNextBiddingPlayer(currentId) {
        const players = this.gameState.players;
        const currentIndex = players.findIndex(p => p.id === currentId);

        for (let i = 1; i <= players.length; i++) {
            const nextIndex = (currentIndex + i) % players.length;
            const player = players[nextIndex];
            if (!player.eliminated && !this.gameState.passedPlayers.includes(player.id)) {
                return player;
            }
        }
        return players.find(p => p.id === this.gameState.challengerId);
    }

    getTotalCardsOnTable() {
        return this.gameState.players
            .filter(p => !p.eliminated)
            .reduce((sum, p) => sum + p.stack.length, 0);
    }

    getSanitizedPlayers() {
        return this.gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            colorCode: p.colorCode,
            handCount: p.hand.length,
            stack: p.stack.map(c => ({
                revealed: c.revealed,
                type: c.revealed ? c.type : null
            })),
            wins: p.wins,
            eliminated: p.eliminated
        }));
    }

    getSanitizedState() {
        return {
            players: this.getSanitizedPlayers(),
            phase: this.gameState.phase,
            hostId: this.gameState.hostId,
            currentTurnId: this.gameState.currentTurnId,
            firstPlayerId: this.gameState.firstPlayerId,
            challengerId: this.gameState.challengerId,
            currentBid: this.gameState.currentBid,
            revealedCount: this.gameState.revealedCount,
            passedPlayers: this.gameState.passedPlayers,
            placementRound: this.gameState.placementRound,
            totalCardsOnTable: this.getTotalCardsOnTable(),
            gameStarted: this.gameState.gameStarted,
            turnDeadline: this.gameState.turnDeadline
        };
    }

    broadcast(message) {
        // For messages with player data, send personalized state (own cards visible)
        // Check for message.players OR message.state (which contains players)
        if (message.type === 'state' || message.players || message.state) {
            for (const conn of this.room.getConnections()) {
                const personalizedMessage = { ...message };

                // Find this player's data and include their full hand
                const player = this.gameState.players.find(p => p.id === conn.id);
                if (player) {
                    personalizedMessage.myHand = player.hand;
                    personalizedMessage.myStack = player.stack;
                }

                conn.send(JSON.stringify(personalizedMessage));
            }
        } else {
            this.room.broadcast(JSON.stringify(message));
        }
    }

    // === TIMER ===

    startTurnTimer() {
        // Clear existing timer
        if (this.turnTimeout) {
            clearTimeout(this.turnTimeout);
            this.turnTimeout = null;
        }

        const duration = this.gameState.turnTimerDuration;
        if (!duration || duration <= 0) {
            this.gameState.turnDeadline = null;
        }

        // Set deadline
        this.gameState.turnDeadline = Date.now() + (duration * 1000);

        // Broadcast timer update
        this.broadcast({
            type: 'timerUpdate',
            turnDeadline: this.gameState.turnDeadline,
            currentTurnId: this.gameState.currentTurnId
        });

        // Set timeout
        this.turnTimeout = setTimeout(() => {
            this.handleTurnTimeout();
        }, duration * 1000);
    }

    handleTurnTimeout() {
        const currentTurnId = this.gameState.currentTurnId;
        const player = this.gameState.players.find(p => p.id === currentTurnId);
        if (!player || player.eliminated) return;

        console.log(`Time out for player ${player.name} in phase ${this.gameState.phase}`);

        // Auto-action based on phase
        switch (this.gameState.phase) {
            case 'PLACEMENT':
                // If hand not empty, place random card
                if (player.hand.length > 0) {
                    const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
                    this.handlePlaceCard({ cardType: randomCard }, { id: player.id });
                } else {
                    // Hand empty, must challenge. Challenge with min bid (1 or current+1).
                    // Auto-bid 1.
                    this.handleChallenge({ bid: 1 }, { id: player.id });
                }
                break;

            case 'CHALLENGE':
                // Pass
                this.handlePass({ id: player.id });
                break;

            case 'CARD_LOSS':
                // Random loss
                this.randomCardLoss(player);
                break;

            case 'CHOOSE_FIRST_PLAYER':
                // Choose self if possible, or random active player
                const activePlayers = this.gameState.players.filter(p => !p.eliminated);
                const randomNext = activePlayers[Math.floor(Math.random() * activePlayers.length)];
                this.handleChooseFirstPlayer({ playerId: randomNext.id }, { id: player.id });
                break;
        }
    }
}
