// Game utilities and state management for Skull

// Color codes mapping - c01 to c06
export const COLOR_CODES = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06'];

// Get image paths for a player's color code
export function getImagePaths(colorCode) {
    return {
        matSkull: `/mats/mats_r02_${colorCode}.png`,      // r02 = skull side (initial)
        matFlower: `/mats/mats_r01_${colorCode}.png`,     // r01 = flower side (win)
        discBack: `/coasters/coasters_r01_${colorCode}.png`,   // r01 = back (face down)
        discFlower: `/coasters/coasters_r02_${colorCode}.png`, // r02 = flower face
        discSkull: `/coasters/coasters_r03_${colorCode}.png`   // r03 = skull face
    };
}

// Generate room code
export function generateRoomCode(length = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Calculate player positions around the table
export function calculatePlayerPositions(playerCount, currentPlayerIndex, viewportWidth, viewportHeight) {
    const positions = [];
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    // Elliptical layout
    const radiusX = Math.min(viewportWidth * 0.35, 320);
    const radiusY = Math.min(viewportHeight * 0.32, 240);

    // Start from bottom (current player) and go clockwise
    const startAngle = Math.PI / 2; // Bottom

    for (let i = 0; i < playerCount; i++) {
        // Reorder so current player is always at bottom
        const adjustedIndex = (i + currentPlayerIndex) % playerCount;
        const angle = startAngle + (i * 2 * Math.PI / playerCount);

        positions[adjustedIndex] = {
            x: centerX + radiusX * Math.cos(angle),
            y: centerY + radiusY * Math.sin(angle),
            isCurrentPlayer: adjustedIndex === currentPlayerIndex
        };
    }

    return positions;
}

// Fisher-Yates shuffle
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Game state class for client-side
export class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.roomCode = '';
        this.players = [];
        this.currentPlayerId = null;
        this.hostId = null;
        this.phase = 'LOBBY'; // LOBBY, PLACEMENT, CHALLENGE, REVELATION, CARD_LOSS
        this.currentTurnId = null;
        this.challengerId = null;
        this.currentBid = 0;
        this.revealedCount = 0;
        this.totalCardsOnTable = 0;
        this.passedPlayers = [];
        this.gameStarted = false;
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    getCurrentPlayer() {
        return this.getPlayer(this.currentPlayerId);
    }

    getPlayerIndex(playerId) {
        return this.players.findIndex(p => p.id === playerId);
    }
}
