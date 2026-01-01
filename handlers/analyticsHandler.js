/**
 * Analytics Handler - Handles Firebase tracking events
 * Listens to game events and tracks to Firebase in background
 */
const eventBus = require('../eventBus');

// Firebase helpers will be injected
let trackPlayer = async () => { };
let updatePlayerScore = async () => { };
let saveGameResult = async () => { };

/**
 * Initialize handler with Firebase helpers
 * @param {Object} firebaseHelpers - Firebase helper functions
 */
function init(helpers) {
    if (helpers) {
        trackPlayer = helpers.trackPlayer || trackPlayer;
        updatePlayerScore = helpers.updatePlayerScore || updatePlayerScore;
        saveGameResult = helpers.saveGameResult || saveGameResult;
        console.log('📊 [Analytics] Handler initialized with Firebase');
    } else {
        console.log('📊 [Analytics] Handler initialized (no Firebase)');
    }

    // Register event listeners
    registerListeners();
}

function registerListeners() {
    // Track player when they join
    eventBus.on('PLAYER_JOINED', async ({ playerId, nickname, roomCode }) => {
        console.log(`📊 [Analytics] Tracking player: ${nickname}`);
        await trackPlayer(playerId, nickname);
    });

    // Update score in Firebase (debounced in actual implementation)
    eventBus.on('SCORE_UPDATED', async ({ playerId, score, roomCode }) => {
        // Only update at end of game to reduce writes
        // Individual score updates are handled in GAME_ENDED
    });

    // Save final game results
    eventBus.on('GAME_ENDED', async ({ roomCode, gameMode, leaderboard, winner }) => {
        console.log(`📊 [Analytics] Saving game result for room ${roomCode}`);
        const gameId = `${gameMode.toLowerCase()}_${roomCode}_${Date.now()}`;
        await saveGameResult(gameId, gameMode, roomCode, leaderboard, winner);

        // Update final scores for all players
        for (const player of leaderboard) {
            await updatePlayerScore(player.id, player.score);
        }
    });
}

module.exports = { init };
