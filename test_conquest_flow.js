// Simple test to verify Conquest game flow
// Run with: node test_conquest_flow.js

const io = require('socket.io-client');

console.log('🧪 Testing Conquest Game Flow...\n');

// Connect as host
const hostSocket = io('http://localhost:3000');

hostSocket.on('connect', () => {
    console.log('✅ Host connected');

    // Create conquest room
    hostSocket.emit('createConquestRoom');
});

hostSocket.on('conquestRoomCreated', ({ roomCode }) => {
    console.log(`✅ Room created: ${roomCode}\n`);

    // Connect player
    const playerSocket = io('http://localhost:3000');

    playerSocket.on('connect', () => {
        console.log('✅ Player connected');
        playerSocket.emit('joinConquestRoom', { roomCode, nickname: 'TestPlayer' });
    });

    playerSocket.on('conquestJoined', () => {
        console.log('✅ Player joined room\n');

        // Start game
        setTimeout(() => {
            console.log('🎮 Starting game...');
            hostSocket.emit('startConquestGame', { roomCode });
        }, 1000);
    });

    playerSocket.on('conquestRoundStart', (data) => {
        console.log(`\n📍 ROUND ${data.roundNumber} STARTED`);
        console.log(`   Duration: ${data.duration}ms`);
        console.log(`   AP: ${data.currentAP}`);

        // Player submits actions
        const actions = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 }
        ];

        console.log(`   Player submitting ${actions.length} actions:`, actions);
        playerSocket.emit('conquestSubmitActions', { roomCode, actions });
    });

    playerSocket.on('conquestRoundEnd', (data) => {
        console.log(`\n✅ ROUND END`);
        console.log(`   Your Territory: ${data.yourTerritory}`);
        console.log(`   Your Rank: #${data.yourRank}`);
        console.log(`   Conflicts: ${data.conflicts.length}`);

        if (data.yourTerritory === 0) {
            console.error('❌ FAIL: Territory is 0! Bug still exists!');
        } else {
            console.log('✅ SUCCESS: Territory count working!');
        }
    });
});

hostSocket.on('conquestMapUpdate', (data) => {
    console.log('\n📊 MAP UPDATE');

    // Count claimed cells
    let totalClaimed = 0;
    for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
            if (data.grid[x][y] !== null) totalClaimed++;
        }
    }

    console.log(`   Total cells claimed: ${totalClaimed}`);
    console.log(`   Conflicts: ${data.conflictsThisRound.length}`);
    console.log(`   Leaderboard:`, data.leaderboard.map(p => `${p.nickname}: ${p.territory}`));
});

// Timeout
setTimeout(() => {
    console.log('\n⏱️ Test timeout - closing...');
    process.exit(0);
}, 30000);
