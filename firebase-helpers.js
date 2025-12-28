// Firebase Configuration Helper
// Add this at the top of server.js after require statements

const admin = require('firebase-admin');

// Initialize Firebase (if credentials file exists)
let db = null;
try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.log('⚠️  Firebase not configured (optional) - Player tracking disabled');
    console.log('   To enable: Add firebase-service-account.json to project root');
}

// Helper Functions

async function trackPlayer(playerId, nickname) {
    if (!db) return;

    try {
        const playerRef = db.collection('players').doc(playerId);
        const doc = await playerRef.get();

        if (doc.exists) {
            // Increment games played
            await playerRef.update({
                lastPlayed: admin.firestore.FieldValue.serverTimestamp(),
                gamesPlayed: admin.firestore.FieldValue.increment(1)
            });
        } else {
            // Create new player
            await playerRef.set({
                nickname,
                gamesPlayed: 1,
                totalScore: 0,
                lastPlayed: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Firebase trackPlayer error:', error);
    }
}

async function updatePlayerScore(playerId, scoreGained) {
    if (!db) return;

    try {
        await db.collection('players').doc(playerId).update({
            totalScore: admin.firestore.FieldValue.increment(scoreGained)
        });
    } catch (error) {
        console.error('Firebase updatePlayerScore error:', error);
    }
}

async function saveGameResult(gameId, gameMode, roomCode, players, winner) {
    if (!db) return;

    try {
        await db.collection('gameHistory').doc(gameId).set({
            roomCode,
            mode: gameMode,
            players: players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                score: p.score || p.territory || 0
            })),
            winner: winner ? {
                id: winner.id,
                nickname: winner.nickname,
                score: winner.score || winner.territory || 0
            } : null,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`📊 Game ${gameId} saved to Firebase`);
    } catch (error) {
        console.error('Firebase saveGameResult error:', error);
    }
}

module.exports = { trackPlayer, updatePlayerScore, saveGameResult };
