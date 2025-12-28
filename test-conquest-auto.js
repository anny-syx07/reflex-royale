// Automated E2E Test for Conquest Game
// Run: node test-conquest-auto.js

const io = require('socket.io-client');

const SERVER = 'http://localhost:3000';
let passed = 0;
let failed = 0;

console.log('🧪 Starting Automated Conquest Tests...\n');

// Test 1: Create Room
async function testCreateRoom() {
    return new Promise((resolve) => {
        console.log('Test 1: Create Room');
        const host = io(SERVER);

        host.on('conquestRoomCreated', (data) => {
            if (data.roomCode && data.roomCode.match(/\d{4}/)) {
                console.log('✅ PASS: Room created with code', data.roomCode);
                passed++;
                host.disconnect();
                resolve(data.roomCode);
            } else {
                console.log('❌ FAIL: Invalid room code');
                failed++;
                host.disconnect();
                resolve(null);
            }
        });

        host.emit('createConquestRoom');
    });
}

// Test 2: Join Room
async function testJoinRoom(roomCode) {
    return new Promise((resolve) => {
        console.log('\nTest 2: Join Room');
        const player = io(SERVER);

        player.on('conquestJoined', () => {
            console.log('✅ PASS: Player joined successfully');
            passed++;
            player.disconnect();
            resolve(true);
        });

        player.on('error', (err) => {
            console.log('❌ FAIL: Join failed -', err.message);
            failed++;
            player.disconnect();
            resolve(false);
        });

        player.emit('joinConquestRoom', { roomCode, nickname: 'TestPlayer' });
    });
}

// Test 3: Start Game & Round
async function testGameFlow() {
    return new Promise((resolve) => {
        console.log('\nTest 3: Game Flow (Start → Round → Actions)');
        const host = io(SERVER);
        const player = io(SERVER);
        let roomCode;

        host.on('conquestRoomCreated', (data) => {
            roomCode = data.roomCode;
            console.log('  → Room created:', roomCode);

            player.emit('joinConquestRoom', { roomCode, nickname: 'Bot1' });
        });

        player.on('conquestJoined', () => {
            console.log('  → Player joined');
            host.emit('startConquestGame', { roomCode });
        });

        let roundStarted = false;
        player.on('conquestRoundStart', (data) => {
            if (!roundStarted) {
                roundStarted = true;
                console.log(`  → Round ${data.roundNumber} started`);

                // Submit actions
                const actions = [
                    { x: 1, y: 1 },
                    { x: 2, y: 2 },
                    { x: 3, y: 3 }
                ];
                player.emit('conquestSubmitActions', { roomCode, actions });
                console.log('  → Actions submitted');
            }
        });

        player.on('conquestRoundEnd', (data) => {
            console.log('  → Round ended, territory:', data.yourTerritory);

            if (data.yourTerritory >= 3) {
                console.log('✅ PASS: Actions processed, territory counted correctly');
                passed++;
            } else {
                console.log('❌ FAIL: Territory count wrong. Expected >=3, got', data.yourTerritory);
                failed++;
            }

            host.disconnect();
            player.disconnect();
            resolve();
        });

        host.emit('createConquestRoom');

        // Timeout failsafe
        setTimeout(() => {
            console.log('❌ FAIL: Test timeout');
            failed++;
            host.disconnect();
            player.disconnect();
            resolve();
        }, 20000);
    });
}

// Test 4: Multiple Players
async function testMultiplePlayers() {
    return new Promise((resolve) => {
        console.log('\nTest 4: Multiple Players (Conflict Resolution)');
        const host = io(SERVER);
        const p1 = io(SERVER);
        const p2 = io(SERVER);
        let roomCode;

        host.on('conquestRoomCreated', (data) => {
            roomCode = data.roomCode;
            p1.emit('joinConquestRoom', { roomCode, nickname: 'Player1' });
            p2.emit('joinConquestRoom', { roomCode, nickname: 'Player2' });
        });

        let joined = 0;
        function checkStart() {
            joined++;
            if (joined === 2) {
                console.log('  → 2 players joined');
                host.emit('startConquestGame', { roomCode });
            }
        }

        p1.on('conquestJoined', checkStart);
        p2.on('conquestJoined', checkStart);

        let roundStarted = false;
        p1.on('conquestRoundStart', () => {
            if (!roundStarted) {
                roundStarted = true;
                // Both claim same cell = conflict
                p1.emit('conquestSubmitActions', {
                    roomCode,
                    actions: [{ x: 5, y: 5 }, { x: 1, y: 1 }]
                });
                p2.emit('conquestSubmitActions', {
                    roomCode,
                    actions: [{ x: 5, y: 5 }, { x: 2, y: 2 }]
                });
            }
        });

        p1.on('conquestRoundEnd', (data) => {
            console.log('  → Player 1 territory:', data.yourTerritory);

            // Should be 1 (conflict on 5,5, only 1,1 claimed)
            if (data.yourTerritory === 1) {
                console.log('✅ PASS: Conflict resolution works');
                passed++;
            } else {
                console.log('❌ FAIL: Conflict resolution broken');
                failed++;
            }

            host.disconnect();
            p1.disconnect();
            p2.disconnect();
            resolve();
        });

        host.emit('createConquestRoom');

        setTimeout(() => {
            console.log('❌ FAIL: Test timeout');
            failed++;
            host.disconnect();
            p1.disconnect();
            p2.disconnect();
            resolve();
        }, 20000);
    });
}

// Run all tests
async function runTests() {
    const roomCode = await testCreateRoom();

    if (roomCode) {
        await testJoinRoom(roomCode);
    }

    await testGameFlow();
    await testMultiplePlayers();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    console.log('='.repeat(50));

    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED!');
        process.exit(0);
    } else {
        console.log('\n💥 SOME TESTS FAILED');
        process.exit(1);
    }
}

runTests();
