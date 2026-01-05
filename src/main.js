// Main entry point for Skull Board Game
import { GameState, generateRoomCode, calculatePlayerPositions, COLOR_CODES, getImagePaths } from './game.js';
import PartySocket from 'partysocket';

// Use production PartyKit server
const PARTYKIT_HOST = 'skull-game-server.kennyphan123.partykit.dev';

// App State
const state = {
    socket: null,
    playerId: null,
    playerName: '',
    roomCode: '',
    isHost: false,
    gameState: new GameState(),
    myHand: [],
    myStack: [],
    myColorCode: null,
    pingInterval: null,
    cardLossProcessing: false, // Prevent spam clicks during card loss
    // Bid stepper state
    bidValue: 1,
    bidMin: 1,
    bidMax: 24,
    challengeBidValue: 1,
    challengeBidMin: 1,
    challengeBidValue: 1,
    challengeBidMin: 1,
    challengeBidMin: 1,
    challengeBidMax: 24,
    myPlacementHistory: [], // Array of 'flower' or 'skull'
    timerDuration: 0, // 0 = off
    timerInterval: null
};

// DOM Elements
const elements = {
    // Screens
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game'),

    // Lobby elements
    mainMenu: document.getElementById('mainMenu'),
    showCreate: document.getElementById('showCreate'),
    showJoin: document.getElementById('showJoin'),
    createForm: document.getElementById('createForm'),
    joinForm: document.getElementById('joinForm'),
    createName: document.getElementById('createName'),
    joinName: document.getElementById('joinName'),
    roomCode: document.getElementById('roomCode'),
    createRoom: document.getElementById('createRoom'),
    joinRoom: document.getElementById('joinRoom'),
    roomInfo: document.getElementById('roomInfo'),
    displayRoomCode: document.getElementById('displayRoomCode'),
    playerCount: document.getElementById('playerCount'),
    playerList: document.getElementById('playerList'),
    startGame: document.getElementById('startGame'),
    waitingText: document.querySelector('.waiting-text'),

    gameTable: document.getElementById('gameTable'),
    playersContainer: document.getElementById('playersContainer'),
    centerArea: document.getElementById('centerArea'),
    gameStatus: document.getElementById('gameStatus'),
    bidInfo: document.getElementById('bidInfo'),
    bidLabel: document.getElementById('bidLabel'),
    currentBid: document.getElementById('currentBid'),

    // Action panel
    actionPanel: document.getElementById('actionPanel'),
    placementActions: document.getElementById('placementActions'),
    addDiscBtn: document.getElementById('addDiscBtn'),
    showChallengeBtn: document.getElementById('showChallengeBtn'),
    challengeSelector: document.getElementById('challengeSelector'),
    challengeBidAmount: document.getElementById('challengeBidAmount'),
    challengeBidIncrease: document.getElementById('challengeBidIncrease'),
    challengeBidDecrease: document.getElementById('challengeBidDecrease'),
    confirmChallenge: document.getElementById('confirmChallenge'),
    biddingActions: document.getElementById('biddingActions'),
    raiseBid: document.getElementById('raiseBid'),
    passBid: document.getElementById('passBid'),
    bidSelector: document.getElementById('bidSelector'),
    bidAmount: document.getElementById('bidAmount'),
    bidIncrease: document.getElementById('bidIncrease'),
    bidDecrease: document.getElementById('bidDecrease'),
    confirmBid: document.getElementById('confirmBid'),
    revelationActions: document.getElementById('revelationActions'),
    revealProgress: document.getElementById('revealProgress'),
    cardLossActions: document.getElementById('cardLossActions'),
    popupBidDisplay: document.getElementById('popupBidDisplay'),

    // Personal History
    personalHistory: document.getElementById('personalHistory'),
    historyList: document.getElementById('historyList'),

    // Timer
    timerDurationInput: document.getElementById('timerDuration'),
    turnTimer: document.getElementById('turnTimer'),
    timerValue: document.getElementById('timerValue'),

    // Modals
    gameOverModal: document.getElementById('gameOverModal'),
    gameOverMessage: document.getElementById('gameOverMessage'),
    playAgain: document.getElementById('playAgain'),
    roundResultModal: document.getElementById('roundResultModal'),
    roundResultTitle: document.getElementById('roundResultTitle'),
    roundResultMessage: document.getElementById('roundResultMessage'),
    continueGame: document.getElementById('continueGame'),
    // Error modal
    errorModal: document.getElementById('errorModal'),
    errorMessage: document.getElementById('errorMessage'),
    errorOk: document.getElementById('errorOk')
};

function init() {
    setupLobbyHandlers();
    setupGameHandlers();

    window.addEventListener('resize', () => {
        if (state.gameState.gameStarted) {
            // Re-render players (mats) on resize
            // Also re-render hand since it's a child of mat-container which gets recreated
            renderPlayers();
            // Only force-show hand if action panel is hidden (user already clicked Add Disc)
            // If action panel is visible, don't show hand (user hasn't clicked Add Disc yet)
            const actionPanelHidden = elements.actionPanel.classList.contains('hidden');
            renderPlayerHand(state.gameState.placementRound >= 2 && actionPanelHidden);
        }
    });
}

// === LOBBY ===
function setupLobbyHandlers() {
    elements.showCreate.addEventListener('click', () => {
        elements.mainMenu.classList.add('hidden');
        elements.createForm.classList.remove('hidden');
    });

    elements.showJoin.addEventListener('click', () => {
        elements.mainMenu.classList.add('hidden');
        elements.joinForm.classList.remove('hidden');
    });

    elements.createRoom.addEventListener('click', () => {
        const name = elements.createName.value.trim();
        const duration = parseInt(elements.timerDurationInput.value, 10);

        if (!name) {
            showError('Please enter your name');
            return;
        }
        state.playerName = name;
        state.roomCode = generateRoomCode(4);
        state.isHost = true;
        state.timerDuration = duration;
        connectToRoom();
    });

    elements.joinRoom.addEventListener('click', () => {
        const name = elements.joinName.value.trim();
        const code = elements.roomCode.value.trim().toUpperCase();
        if (!name) {
            showError('Please enter your name');
            return;
        }
        if (!code || code.length !== 4) {
            showError('Please enter 4-letter room code');
            return;
        }
        state.playerName = name;
        state.roomCode = code;
        state.isHost = false;
        connectToRoom();
    });

    elements.startGame.addEventListener('click', () => {
        if (state.socket && state.isHost) {
            state.socket.send(JSON.stringify({
                type: 'start',
                timerDuration: state.timerDuration
            }));
        }
    });

    // Back buttons
    document.getElementById('backFromCreate')?.addEventListener('click', () => {
        elements.createForm.classList.add('hidden');
        elements.mainMenu.classList.remove('hidden');
    });

    document.getElementById('backFromJoin')?.addEventListener('click', () => {
        elements.joinForm.classList.add('hidden');
        elements.mainMenu.classList.remove('hidden');
    });

    // Copy button
    document.getElementById('copyCodeBtn')?.addEventListener('click', copyRoomCode);
}

function copyRoomCode() {
    const code = elements.displayRoomCode.textContent;
    const copyBtn = document.getElementById('copyCodeBtn');

    navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Tap to Copy';
        }, 2000);
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Tap to Copy';
        }, 2000);
    });
}

function connectToRoom() {
    state.socket = new PartySocket({
        host: PARTYKIT_HOST,
        room: state.roomCode
    });

    state.socket.addEventListener('open', () => {
        state.playerId = state.socket.id;
        state.socket.send(JSON.stringify({
            type: 'join',
            name: state.playerName,
            isCreator: state.isHost
        }));
        // Only show room info after successful join (will be confirmed by playerJoined message)
        // For creators, show immediately. For joiners, wait for confirmation.
        if (state.isHost) {
            showRoomInfo();
        }

        // Heartbeat
        if (state.pingInterval) clearInterval(state.pingInterval);
        state.pingInterval = setInterval(() => {
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                state.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    });

    state.socket.addEventListener('message', (event) => {
        handleServerMessage(JSON.parse(event.data));
    });

    state.socket.addEventListener('error', (error) => {
        console.error('Connection error:', error);
    });

    state.socket.addEventListener('close', () => {
        if (state.pingInterval) {
            clearInterval(state.pingInterval);
            state.pingInterval = null;
        }
    });
}

function showRoomInfo() {
    elements.displayRoomCode.textContent = state.roomCode;
    elements.roomInfo.classList.remove('hidden');
    elements.mainMenu.classList.add('hidden');
    elements.createForm.classList.add('hidden');
    elements.joinForm.classList.add('hidden');
}

function returnToMainMenu() {
    // Reset state
    state.socket = null;
    state.playerId = null;
    state.playerName = '';
    state.roomCode = '';
    state.isHost = false;
    state.gameState = new GameState();
    state.myHand = [];
    state.myStack = [];
    state.myColorCode = null;
    state.myPlacementHistory = [];

    // Hide all forms and show main menu
    elements.roomInfo.classList.add('hidden');
    elements.createForm.classList.add('hidden');
    elements.joinForm.classList.add('hidden');
    elements.mainMenu.classList.remove('hidden');
    elements.game.classList.remove('active');
    elements.lobby.classList.add('active');

    // Clear input fields
    elements.createName.value = '';
    elements.joinName.value = '';
    elements.roomCode.value = '';
}

function updatePlayerList() {
    const players = state.gameState.players;
    elements.playerCount.textContent = players.length;

    elements.playerList.innerHTML = players
        .map(p => {
            const isHost = p.id === state.gameState.hostId;
            return `<span class="player-tag${isHost ? ' host' : ''}">${p.name}${isHost ? ' (Host)' : ''}</span>`;
        })
        .join('');

    // Update host status
    state.isHost = state.gameState.hostId === state.playerId;

    if (state.isHost && players.length >= 3) {
        elements.startGame.classList.remove('hidden');
        elements.waitingText.classList.add('hidden');
    } else if (state.isHost) {
        elements.startGame.classList.add('hidden');
        elements.waitingText.textContent = 'Need at least 3 players to start...';
        elements.waitingText.classList.remove('hidden');
    } else {
        elements.startGame.classList.add('hidden');
        elements.waitingText.textContent = 'Waiting for host to start...';
        elements.waitingText.classList.remove('hidden');
    }
}

// === SERVER MESSAGES ===
function handleServerMessage(data) {
    console.log('Server:', data.type, data);

    // Store personal hand/stack info
    if (data.myHand) state.myHand = data.myHand;
    if (data.myStack) state.myStack = data.myStack;

    // Update color code
    const me = data.players?.find(p => p.id === state.playerId);
    if (me?.colorCode) state.myColorCode = me.colorCode;

    switch (data.type) {
        case 'state':
            syncGameState(data.state);
            if (data.state.gameStarted) {
                startGame();
            }
            break;

        case 'playerJoined':
            state.gameState.players = data.players;
            state.gameState.hostId = data.hostId;
            if (data.hostId === state.playerId) {
                state.isHost = true;
            }
            // For joiners (non-host), show room info after successful join
            if (!state.isHost && data.player?.id === state.playerId) {
                showRoomInfo();
            }
            updatePlayerList();
            break;

        case 'playerLeft':
            state.gameState.players = data.players;
            if (data.hostId === state.playerId) {
                state.isHost = true;
            }
            updatePlayerList();
            if (state.gameState.gameStarted) {
                renderGame();
            }
            break;

        case 'gameStarted':
            syncGameState(data.state);
            startGame();
            break;

        case 'cardPlaced':
            state.gameState.players = data.players;
            state.gameState.currentTurnId = data.currentTurnId;
            state.gameState.phase = data.phase;
            state.gameState.placementRound = data.placementRound;
            renderGame();
            break;

        case 'challengeStarted':
            state.gameState.phase = 'CHALLENGE';
            state.gameState.challengerId = data.challengerId;
            state.gameState.currentBid = data.bid;
            state.gameState.currentTurnId = data.currentTurnId;
            state.gameState.totalCardsOnTable = data.totalCards;
            renderGame();
            break;

        case 'bidRaised':
            state.gameState.currentBid = data.bid;
            state.gameState.challengerId = data.challengerId;
            state.gameState.currentTurnId = data.currentTurnId;
            renderGame();
            break;

        case 'playerPassed':
            state.gameState.passedPlayers = data.passedPlayers;
            state.gameState.currentTurnId = data.currentTurnId;
            renderGame();
            break;

        case 'revelationStarted':
            state.gameState.phase = 'REVELATION';
            state.gameState.challengerId = data.challengerId;
            state.gameState.currentBid = data.bid;
            state.gameState.players = data.players;
            state.gameState.revealedCount = 0;
            renderGame();
            break;

        case 'cardRevealed':
            state.gameState.players = data.players;
            state.gameState.revealedCount = data.revealedCount;
            renderGame();
            break;

        case 'skullRevealed':
            state.gameState.phase = 'CARD_LOSS';
            state.gameState.players = data.players;
            state.gameState.currentTurnId = data.currentTurnId;
            // Only show "own skull" message to the challenger, not all players
            const amIChallenger = data.challengerId === state.playerId;
            if (amIChallenger && data.ownSkull) {
                showRoundResult('Skull Revealed!', 'You revealed your own skull! Choose a disc to lose.');
            } else if (amIChallenger) {
                // Challenger hit someone else's skull - skull owner will choose
                showRoundResult('Skull Revealed!', 'You hit a skull! The skull owner will choose a disc for you to lose.');
            } else if (data.skullOwnerId === state.playerId) {
                // I own the skull that was revealed
                showRoundResult('Your Skull!', 'The challenger revealed your skull! Choose a disc for them to lose.');
            } else {
                showRoundResult('Skull Revealed!', 'A skull was revealed!');
            }
            renderGame();
            break;

        case 'roundWon':
            state.gameState.players = data.players;
            showRoundResult('Challenge Won!', `${data.winnerName} won the challenge! (${data.wins}/2 wins)`);
            break;

        case 'cardLost':
            state.gameState.players = data.players;
            if (data.eliminated) {
                showRoundResult('Player Eliminated!', `A player has been eliminated from the game.`);
            }
            break;

        case 'newRound':
            syncGameState(data.state);
            state.cardLossProcessing = false; // Reset spam protection
            state.myPlacementHistory = []; // Clear history for new round
            hideModals();
            renderGame();
            break;

        case 'chooseFirstPlayerPhase':
            state.gameState.phase = 'CHOOSE_FIRST_PLAYER';
            state.gameState.currentTurnId = data.currentTurnId;
            state.gameState.players = data.players;
            hideModals();
            renderGame();
            break;

        case 'gameOver':
            state.gameState.players = data.players;
            showGameOver(data.winnerName, data.reason);
            break;

        case 'gameReset':
            syncGameState(data.state);
            // Go back to room info screen (not main menu)
            elements.game.classList.remove('active');
            elements.lobby.classList.add('active');
            elements.mainMenu.classList.add('hidden');
            elements.createForm.classList.add('hidden');
            elements.joinForm.classList.add('hidden');
            elements.roomInfo.classList.remove('hidden');
            hideModals();
            updatePlayerList();
            break;

        case 'error':
            showError(data.message);
            // If room not found, disconnect and return to join form
            if (data.message.includes('Room not found')) {
                if (state.socket) {
                    state.socket.close();
                    state.socket = null;
                }
                // Return to join form instead of main menu
                elements.roomInfo.classList.add('hidden');
                elements.mainMenu.classList.add('hidden');
                elements.joinForm.classList.remove('hidden');
            }
            break;
    }
}

function syncGameState(serverState) {
    state.gameState.players = serverState.players;
    state.gameState.phase = serverState.phase;
    state.gameState.hostId = serverState.hostId;
    state.gameState.currentTurnId = serverState.currentTurnId;
    state.gameState.firstPlayerId = serverState.firstPlayerId;
    state.gameState.challengerId = serverState.challengerId;
    state.gameState.currentBid = serverState.currentBid;
    state.gameState.revealedCount = serverState.revealedCount;
    state.gameState.passedPlayers = serverState.passedPlayers || [];
    state.gameState.placementRound = serverState.placementRound;
    state.gameState.totalCardsOnTable = serverState.totalCardsOnTable;
    state.gameState.gameStarted = serverState.gameStarted;
}

// === GAME ===
function startGame() {
    elements.lobby.classList.remove('active');
    elements.game.classList.add('active');
    state.gameState.currentPlayerId = state.playerId;
    renderGame();
}

function renderGame() {
    renderPlayers();
    renderPlayerHand();
    renderCenterArea();
    renderCenterArea();
    renderCenterArea();
    renderActionPanel();
    renderPersonalHistory();
    renderTurnTimer();
}

function renderPlayers() {
    const container = elements.playersContainer;
    container.innerHTML = '';

    const players = state.gameState.players;
    const myIndex = players.findIndex(p => p.id === state.playerId);
    const positions = calculatePlayerPositions(
        players.length,
        myIndex,
        window.innerWidth,
        window.innerHeight
    );

    players.forEach((player, index) => {
        const pos = positions[index];
        const isMe = player.id === state.playerId;
        // During REVELATION, highlight the challenger, not currentTurnId
        const isActivePlayer = state.gameState.phase === 'REVELATION'
            ? player.id === state.gameState.challengerId
            : player.id === state.gameState.currentTurnId;
        const isChallenger = player.id === state.gameState.challengerId;
        const hasPassed = state.gameState.passedPlayers?.includes(player.id);
        const images = getImagePaths(player.colorCode);

        const mat = document.createElement('div');
        mat.className = `player-mat${isActivePlayer ? ' active-turn' : ''}`;
        mat.dataset.colorCode = player.colorCode;
        mat.dataset.playerId = player.id;
        mat.style.left = `${pos.x}px`;
        mat.style.top = `${pos.y}px`;

        // Mat image - show flower side if player has won at least once
        const matImageSrc = player.wins > 0 ? images.matFlower : images.matSkull;

        // Build disc stack HTML (discs on mat)
        // Find top unrevealed disc index (last unrevealed = top)
        let topUnrevealedIndex = -1;
        for (let i = player.stack.length - 1; i >= 0; i--) {
            if (!player.stack[i].revealed) {
                topUnrevealedIndex = i;
                break;
            }
        }

        let discStackHtml = '<div class="disc-stack-on-mat">';
        player.stack.forEach((card, cardIndex) => {
            // Only top unrevealed disc is clickable
            const isTopUnrevealed = cardIndex === topUnrevealedIndex;
            const canClick = state.gameState.phase === 'REVELATION' &&
                state.playerId === state.gameState.challengerId &&
                isTopUnrevealed;

            let discImgSrc;
            if (card.revealed) {
                discImgSrc = card.type === 'flower' ? images.discFlower : images.discSkull;
            } else {
                discImgSrc = images.discBack;
            }

            discStackHtml += `
                <div class="stacked-disc${canClick ? ' clickable' : ''}${card.revealed ? ' revealed' : ''}" 
                     data-player-id="${player.id}" 
                     data-card-index="${cardIndex}">
                    <img src="${discImgSrc}" alt="disc">
                </div>`;
        });
        discStackHtml += '</div>';

        // Name tag with status
        let nameClass = 'player-name-tag';
        if (isMe) nameClass += ' current';
        if (player.eliminated) nameClass += ' eliminated';

        let statusText = '';
        if (hasPassed) statusText = ' (passed)';
        if (isChallenger) statusText = ' (challenger)';

        mat.innerHTML = `
            <div class="mat-container">
                <img class="mat-image" src="${matImageSrc}" alt="Player mat">
                ${discStackHtml}
            </div>
            <div class="${nameClass}">${player.name}${statusText} (${player.handCount})</div>
        `;

        container.appendChild(mat);
    });

    // Add click handlers for revelation
    if (state.gameState.phase === 'REVELATION' && state.playerId === state.gameState.challengerId) {
        document.querySelectorAll('.stacked-disc.clickable').forEach(disc => {
            disc.addEventListener('click', () => {
                const targetPlayerId = disc.dataset.playerId;
                state.socket.send(JSON.stringify({
                    type: 'reveal',
                    targetPlayerId
                }));
            });
        });
    }
}

function renderPlayerHand(forceShow = false) {
    // Remove existing hand
    const existingHand = document.querySelector('.player-hand');
    if (existingHand) existingHand.remove();

    // Show hand during placement phase when it's my turn
    const isMyTurn = state.gameState.currentTurnId === state.playerId;
    const isPlacement = state.gameState.phase === 'PLACEMENT';
    const isRound1 = state.gameState.placementRound === 1;

    // Show hand if:
    // 1. It's placement phase, my turn, round 1 (automatic)
    // 2. Or forceShow is true (Add Disc button was clicked in round 2+)
    const shouldShow = isPlacement && isMyTurn && (isRound1 || forceShow);
    if (!shouldShow || state.myHand.length === 0) return;

    const me = state.gameState.players.find(p => p.id === state.playerId);
    if (!me || me.eliminated) return;

    const images = getImagePaths(state.myColorCode);

    // Create hand container
    const handContainer = document.createElement('div');
    handContainer.className = 'player-hand';

    // Sort hand: skull first, then flowers
    const sortedHand = [...state.myHand].sort((a, b) => {
        if (a === 'skull') return -1;
        if (b === 'skull') return 1;
        return 0;
    });

    sortedHand.forEach((cardType, index) => {
        const disc = document.createElement('div');
        disc.className = 'hand-disc';
        disc.dataset.cardType = cardType;

        const imgSrc = cardType === 'flower' ? images.discFlower : images.discSkull;
        disc.innerHTML = `<img src="${imgSrc}" alt="${cardType}">`;

        disc.addEventListener('click', () => {
            state.socket.send(JSON.stringify({
                type: 'placeCard',
                cardType: cardType
            }));
            // Optimistically add to history
            state.myPlacementHistory.push(cardType);
        });

        handContainer.appendChild(disc);
    });

    // Append hand to mat-container - CSS handles centering
    const myMat = document.querySelector(`.player-mat[data-player-id="${state.playerId}"] .mat-container`);
    if (myMat) {
        myMat.appendChild(handContainer);
    } else {
        elements.gameTable.appendChild(handContainer);
    }
}

function renderCenterArea() {
    const phase = state.gameState.phase;

    // Hide status text completely - players know whose turn it is by the glowing mat
    elements.gameStatus.classList.add('hidden');

    // Show bid info during challenge and revelation only
    if (phase === 'CHALLENGE') {
        elements.bidInfo.classList.remove('hidden');
        elements.bidLabel.textContent = 'Bid:';
        elements.currentBid.textContent = state.gameState.currentBid;
    } else if (phase === 'REVELATION') {
        elements.bidInfo.classList.remove('hidden');
        elements.bidInfo.classList.add('revelation-mode');
        elements.bidLabel.textContent = '';
        const remaining = state.gameState.currentBid - state.gameState.revealedCount;
        elements.currentBid.textContent = remaining;
    } else {
        // Hide bid info for all other phases (including PLACEMENT where action panel shows)
        elements.bidInfo.classList.add('hidden');
        elements.bidInfo.classList.remove('revelation-mode');
    }
}

// Helper functions for bid steppers
function updateBidDisplay() {
    elements.bidAmount.textContent = state.bidValue;
    // Disable buttons at limits
    if (elements.bidDecrease) {
        elements.bidDecrease.disabled = state.bidValue <= state.bidMin;
    }
    if (elements.bidIncrease) {
        elements.bidIncrease.disabled = state.bidValue >= state.bidMax;
    }
}

function updateChallengeBidDisplay() {
    elements.challengeBidAmount.textContent = state.challengeBidValue;
    // Disable buttons at limits
    if (elements.challengeBidDecrease) {
        elements.challengeBidDecrease.disabled = state.challengeBidValue <= state.challengeBidMin;
    }
    if (elements.challengeBidIncrease) {
        elements.challengeBidIncrease.disabled = state.challengeBidValue >= state.challengeBidMax;
    }
}

function renderActionPanel() {
    const phase = state.gameState.phase;
    const isMyTurn = state.gameState.currentTurnId === state.playerId;
    const me = state.gameState.players.find(p => p.id === state.playerId);

    // Hide all action groups
    elements.placementActions.classList.add('hidden');
    elements.biddingActions.classList.add('hidden');
    elements.revelationActions.classList.add('hidden');
    elements.cardLossActions.classList.add('hidden');
    elements.actionPanel.classList.add('hidden');
    // Reset position to bottom by default
    elements.actionPanel.classList.remove('top-position');

    // Allow eliminated players to see CHOOSE_FIRST_PLAYER panel (they need to choose who goes next)
    if (me?.eliminated && phase !== 'CHOOSE_FIRST_PLAYER') return;

    switch (phase) {
        case 'PLACEMENT':
            // During initial placement, just show hand (no action panel needed)
            // During add/challenge phase, show buttons
            if (isMyTurn && state.gameState.placementRound >= 2) {
                elements.actionPanel.classList.remove('hidden');
                elements.placementActions.classList.remove('hidden');
                elements.challengeSelector.classList.add('hidden');

                // Per rulebook: if player has no cards in hand, they MUST challenge
                const mustChallenge = state.myHand.length === 0;

                if (mustChallenge) {
                    // Hide Add Disc button - player must challenge
                    elements.addDiscBtn.classList.add('hidden');
                    // Auto-show the challenge selector AND move to top
                    elements.challengeSelector.classList.remove('hidden');
                    elements.actionPanel.classList.add('top-position');
                } else {
                    elements.addDiscBtn.classList.remove('hidden');
                    elements.addDiscBtn.disabled = false;
                }

                // Set challenge bid limits - calculate total discs from all stacks
                let totalCards = 0;
                state.gameState.players.forEach(p => {
                    totalCards += p.stack?.length || 0;
                });
                // Fallback to state if calculation fails
                if (totalCards === 0) totalCards = state.gameState.totalCardsOnTable || 1;

                state.challengeBidMin = 1;
                state.challengeBidMax = totalCards;
                state.challengeBidValue = 1;
                updateChallengeBidDisplay();
            }
            break;

        case 'CHALLENGE':
            if (isMyTurn) {
                elements.actionPanel.classList.remove('hidden');
                elements.biddingActions.classList.remove('hidden');
                elements.bidSelector.classList.add('hidden');

                // Show current bid in popup
                elements.popupBidDisplay.textContent = state.gameState.currentBid;

                // Set bid limits
                const totalCards = state.gameState.totalCardsOnTable;
                state.bidMin = state.gameState.currentBid + 1;
                state.bidMax = totalCards;
                state.bidValue = state.gameState.currentBid + 1;
                updateBidDisplay();
            }
            break;

        case 'REVELATION':
            // No action panel for revelation - just click discs on mats
            // The remaining count is shown in center area
            break;

        case 'CARD_LOSS':
            if (isMyTurn) {
                elements.actionPanel.classList.remove('hidden');
                elements.cardLossActions.classList.remove('hidden');
                renderCardLossSelection();
            }
            break;

        case 'CHOOSE_FIRST_PLAYER':
            // Eliminated player chooses who goes first next round
            if (isMyTurn) {
                elements.actionPanel.classList.remove('hidden');
                elements.cardLossActions.classList.remove('hidden');
                renderChooseFirstPlayerSelection();
            }
            break;
    }
}

function renderCardLossSelection() {
    const container = elements.cardLossActions;

    // Determine if I'm the challenger (choosing my own card) or skull owner (choosing for challenger)
    const amIChallenger = state.gameState.challengerId === state.playerId;
    const challenger = state.gameState.players.find(p => p.id === state.gameState.challengerId);

    if (amIChallenger) {
        // I'm the challenger - I can see my cards and choose which to lose
        const images = getImagePaths(state.myColorCode);

        container.innerHTML = `
            <p class="action-label">Select a disc to lose:</p>
            <div class="loss-selection"></div>
        `;

        const selectionContainer = container.querySelector('.loss-selection');

        // Show all cards (hand + stack)
        const allCards = [...state.myHand, ...state.myStack.map(c => c.type)];

        allCards.forEach((cardType, index) => {
            const btn = document.createElement('button');
            btn.className = 'loss-disc';
            const imgSrc = cardType === 'flower' ? images.discFlower : images.discSkull;
            btn.innerHTML = `<img src="${imgSrc}" alt="${cardType}">`;
            btn.addEventListener('click', () => {
                // Check spam protection flag first
                if (state.cardLossProcessing) return;
                state.cardLossProcessing = true;
                // Disable all buttons to prevent spam
                selectionContainer.querySelectorAll('.loss-disc').forEach(b => {
                    b.disabled = true;
                    b.style.opacity = '0.5';
                    b.style.cursor = 'not-allowed';
                });
                state.socket.send(JSON.stringify({
                    type: 'selectCardLoss',
                    cardIndex: index
                }));
            });
            selectionContainer.appendChild(btn);
        });
    } else {
        // I'm the skull owner - I choose which of challenger's cards to remove (face-down)
        // Per rulebook: cards are shuffled and placed face-down, I pick one
        const challengerImages = getImagePaths(challenger?.colorCode || 'c01');
        const totalCards = (challenger?.handCount || 0) + (challenger?.stack?.length || 0);

        container.innerHTML = `
            <p class="action-label">Choose a disc for the challenger to lose (face-down):</p>
            <div class="loss-selection"></div>
        `;

        const selectionContainer = container.querySelector('.loss-selection');

        // Show face-down cards (we don't know what they are)
        for (let i = 0; i < totalCards; i++) {
            const btn = document.createElement('button');
            btn.className = 'loss-disc';
            btn.innerHTML = `<img src="${challengerImages.discBack}" alt="face-down disc">`;
            btn.addEventListener('click', () => {
                // Check spam protection flag first
                if (state.cardLossProcessing) return;
                state.cardLossProcessing = true;
                // Disable all buttons to prevent spam
                selectionContainer.querySelectorAll('.loss-disc').forEach(b => {
                    b.disabled = true;
                    b.style.opacity = '0.5';
                    b.style.cursor = 'not-allowed';
                });
                state.socket.send(JSON.stringify({
                    type: 'selectCardLoss',
                    cardIndex: i
                }));
            });
            selectionContainer.appendChild(btn);
        }
    }
}

function renderChooseFirstPlayerSelection() {
    const container = elements.cardLossActions;
    const activePlayers = state.gameState.players.filter(p => !p.eliminated);

    container.innerHTML = `
        <p class="action-label">You were eliminated. Choose who starts the next round:</p>
        <div class="player-selection"></div>
    `;

    const selectionContainer = container.querySelector('.player-selection');

    activePlayers.forEach(player => {
        const btn = document.createElement('button');
        btn.className = 'player-select-btn';
        btn.textContent = player.name;
        btn.addEventListener('click', () => {
            // Disable all buttons to prevent spam
            selectionContainer.querySelectorAll('.player-select-btn').forEach(b => {
                b.disabled = true;
                b.style.opacity = '0.5';
                b.style.cursor = 'not-allowed';
            });
            state.socket.send(JSON.stringify({
                type: 'chooseFirstPlayer',
                playerId: player.id
            }));
        });
        selectionContainer.appendChild(btn);
    });
}

function setupGameHandlers() {
    // Add disc button - force show hand for selection
    elements.addDiscBtn?.addEventListener('click', () => {
        // Hide action panel and show hand to select a disc
        elements.actionPanel.classList.add('hidden');
        renderPlayerHand(true);
    });

    // Challenge button - show bid selector and move to top
    elements.showChallengeBtn?.addEventListener('click', () => {
        elements.challengeSelector.classList.toggle('hidden');
        elements.actionPanel.classList.toggle('top-position');
    });

    // Challenge bid stepper controls
    elements.challengeBidIncrease?.addEventListener('click', () => {
        if (state.challengeBidValue < state.challengeBidMax) {
            state.challengeBidValue++;
            updateChallengeBidDisplay();
        }
    });

    elements.challengeBidDecrease?.addEventListener('click', () => {
        if (state.challengeBidValue > state.challengeBidMin) {
            state.challengeBidValue--;
            updateChallengeBidDisplay();
        }
    });

    // Confirm challenge with selected bid
    elements.confirmChallenge?.addEventListener('click', () => {
        const bid = state.challengeBidValue;
        state.socket.send(JSON.stringify({ type: 'challenge', bid }));
        elements.challengeSelector.classList.add('hidden');
        elements.actionPanel.classList.remove('top-position');
    });

    // Bidding actions - show stepper
    elements.raiseBid?.addEventListener('click', () => {
        elements.bidSelector.classList.toggle('hidden');
        elements.actionPanel.classList.toggle('top-position');
    });

    // Bid stepper controls
    elements.bidIncrease?.addEventListener('click', () => {
        if (state.bidValue < state.bidMax) {
            state.bidValue++;
            updateBidDisplay();
        }
    });

    elements.bidDecrease?.addEventListener('click', () => {
        if (state.bidValue > state.bidMin) {
            state.bidValue--;
            updateBidDisplay();
        }
    });

    // Confirm bid with selected value
    elements.confirmBid?.addEventListener('click', () => {
        const bid = state.bidValue;
        state.socket.send(JSON.stringify({ type: 'raise', bid }));
        elements.bidSelector.classList.add('hidden');
        elements.actionPanel.classList.remove('top-position');
    });

    elements.passBid?.addEventListener('click', () => {
        state.socket.send(JSON.stringify({ type: 'pass' }));
    });

    // Modals
    elements.playAgain?.addEventListener('click', () => {
        state.socket.send(JSON.stringify({ type: 'reset' }));
    });

    elements.continueGame?.addEventListener('click', () => {
        elements.roundResultModal.classList.add('hidden');
    });

    elements.errorOk?.addEventListener('click', () => {
        elements.errorModal.classList.add('hidden');
    });
}

function showRoundResult(title, message) {
    elements.roundResultTitle.textContent = title;
    elements.roundResultMessage.textContent = message;
    elements.roundResultModal.classList.remove('hidden');
}

function showGameOver(winnerName, reason) {
    let message = `${winnerName} wins the game!`;
    if (reason === 'lastStanding') {
        message = `${winnerName} is the last player standing!`;
    }
    elements.gameOverMessage.textContent = message;

    // Only show Play Again button for host
    if (state.isHost) {
        elements.playAgain.classList.remove('hidden');
    } else {
        elements.playAgain.classList.add('hidden');
    }

    elements.gameOverModal.classList.remove('hidden');
}

function hideModals() {
    elements.gameOverModal.classList.add('hidden');
    elements.roundResultModal.classList.add('hidden');
    elements.errorModal.classList.add('hidden');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.remove('hidden');
}

// Start
init();

function renderPersonalHistory() {
    const history = state.myPlacementHistory;
    const historyContainer = elements.personalHistory;
    const listContainer = elements.historyList;

    // Only show if we have placed cards
    if (!history || history.length === 0) {
        historyContainer.classList.add('hidden');
        return;
    }

    historyContainer.classList.remove('hidden');

    // Clear current list
    listContainer.innerHTML = '';

    // Render items (bottom to top)
    history.forEach((cardType, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const text = cardType === 'skull' ? 'Skull' : 'Flower';
        const typeClass = cardType;

        item.innerHTML = `<span class="history-type ${typeClass}">${text}</span>`;

        if (index < history.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'history-arrow';
            arrow.textContent = '→';
            listContainer.appendChild(item);
            listContainer.appendChild(arrow);
        } else {
            listContainer.appendChild(item);
        }
    });
}
