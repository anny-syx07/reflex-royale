/**
 * Leaderboard Handler - Handles leaderboard updates
 * Throttles and broadcasts leaderboard to rooms
 */
const eventBus = require('../eventBus');

// Will be injected from server
let io = null;
let rooms = null;

// Throttle state per room
const lastUpdateTimes = new Map();
const THROTTLE_MS = 1000; // 1 second throttle

/**
 * Initialize handler with Socket.IO and rooms reference
 * @param {Object} socketIO - Socket.IO instance
 * @param {Map} roomsMap - Rooms Map reference
 */
function init(socketIO, roomsMap) {
    io = socketIO;
    rooms = roomsMap;
    console.log('🏆 [Leaderboard] Handler initialized');

    // Register event listeners
    registerListeners();
}

function registerListeners() {
    // Update leaderboard when score changes
    eventBus.on('SCORE_UPDATED', async ({ roomCode, playerId, score }) => {
        if (!io || !rooms) return;

        const room = rooms.get(roomCode);
        if (!room) return;

        // Throttle updates
        const lastUpdate = lastUpdateTimes.get(roomCode) || 0;
        const now = Date.now();

        if (now - lastUpdate < THROTTLE_MS) {
            return; // Skip this update, throttled
        }

        lastUpdateTimes.set(roomCode, now);

        // Calculate and broadcast leaderboard
        const leaderboard = Array.from(room.players.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(p => ({ id: p.id, nickname: p.nickname, score: p.score }));

        io.to(roomCode).emit('leaderboardUpdate', { leaderboard });
    });

    // Force update at end of round (bypass throttle)
    eventBus.on('ROUND_ENDED', async ({ roomCode }) => {
        if (!io || !rooms) return;

        const room = rooms.get(roomCode);
        if (!room) return;

        const leaderboard = Array.from(room.players.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(p => ({ id: p.id, nickname: p.nickname, score: p.score }));

        io.to(roomCode).emit('leaderboardUpdate', { leaderboard });
        lastUpdateTimes.set(roomCode, Date.now());
    });

    // Clean up throttle state when game ends
    eventBus.on('GAME_ENDED', async ({ roomCode }) => {
        lastUpdateTimes.delete(roomCode);
    });
}

module.exports = { init };
