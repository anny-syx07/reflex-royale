// Conquest Host - Client-side logic
// Extracted from inline script for better organization

const socket = io();

let roomCode = null;
let grid = null;
let renderer = null;
let timerInterval = null;

// DOM Elements - cached for performance
const els = {
    waitingScreen: document.getElementById('waitingScreen'),
    mainDisplay: document.getElementById('mainDisplay'),
    sidebar: document.getElementById('sidebar'),
    roomCode: document.getElementById('roomCode'),
    playerCount: document.getElementById('playerCount'),
    gridContainer: document.getElementById('gridContainer'),
    gameStatus: document.getElementById('gameStatus'),
    timerValue: document.getElementById('timer'),
    startBtn: document.getElementById('startBtn'),
    nextBtn: document.getElementById('nextBtn'),
    leaderboardList: document.getElementById('leaderboardList'),
    roundInfo: document.getElementById('roundDisplay')
};

// Check for existing room to reconnect
const savedRoomCode = localStorage.getItem('conquestHostRoom');
if (savedRoomCode) {
    console.log('[Conquest Host] Found saved room:', savedRoomCode);
    socket.emit('reconnectHost', { roomCode: savedRoomCode });
}

// Handle reconnection result
socket.on('reconnectResult', ({ success, roomCode: code, gameState: state, players, gameMode, message }) => {
    if (success && gameMode === 'CONQUEST') {
        console.log('[Conquest Host] Reconnected to room:', code);
        roomCode = code;
        els.roomCode.textContent = roomCode;
        els.waitingScreen.classList.add('hidden');
        els.mainDisplay.style.display = 'flex';
        els.sidebar.style.display = 'flex';

        // Initialize grid
        grid = new ConquestGrid(10);
        grid.initializeSpecialCells(8);
        renderer = new ConquestRenderer(els.gridContainer, grid, {
            large: true,
            clickable: false
        });

        // Update player count
        if (players) {
            els.playerCount.textContent = players.length;
            updateLeaderboard(players);
        }

        // Restore UI based on state
        if (state === 'WAITING') {
            els.startBtn.style.display = 'block';
            els.nextBtn.style.display = 'none';
        } else if (state === 'PLAYING') {
            els.startBtn.style.display = 'none';
        }
    } else if (!success) {
        console.log('[Conquest Host] Could not reconnect:', message);
        localStorage.removeItem('conquestHostRoom');
    }
});

// Create new room
function createRoom() {
    socket.emit('createConquestRoom');
}

// Room created
socket.on('conquestRoomCreated', (data) => {
    roomCode = data.roomCode;
    els.roomCode.textContent = roomCode;
    localStorage.setItem('conquestHostRoom', roomCode);
    els.waitingScreen.classList.add('hidden');
    els.mainDisplay.style.display = 'flex';
    els.sidebar.style.display = 'flex';

    // Initialize grid
    grid = new ConquestGrid(10);
    grid.initializeSpecialCells(8);
    renderer = new ConquestRenderer(els.gridContainer, grid, {
        large: true,
        clickable: false
    });

    // Generate QR code
    generateQRCode(roomCode);
});

// Generate QR code for room
function generateQRCode(code) {
    const canvas = document.getElementById('qrCode');
    if (!canvas || typeof QRCode === 'undefined') {
        console.log('[Conquest Host] QR Code generation skipped');
        return;
    }

    const playerUrl = `${window.location.origin}/player.html?roomCode=${code}&mode=conquest`;

    QRCode.toCanvas(canvas, playerUrl, {
        width: 120,
        margin: 1,
        errorCorrectionLevel: 'L',
        color: {
            dark: '#667eea',
            light: '#ffffff'
        }
    }, (error) => {
        if (error) {
            console.error('[Conquest Host] QR Code error:', error);
        } else {
            console.log('[Conquest Host] QR Code generated for:', playerUrl);
        }
    });
}

// Player list update
socket.on('conquestPlayerListUpdate', (data) => {
    els.playerCount.textContent = data.players.length;
    updateLeaderboard(data.players);
});

// Start game
function startGame() {
    socket.emit('startConquestGame', { roomCode });
}

// Game started
socket.on('conquestGameStarted', () => {
    els.startBtn.style.display = 'none';
    els.gameStatus.textContent = 'Trò chơi đang bắt đầu...';
});

// Round started
socket.on('conquestRoundStart', (data) => {
    console.log('[Conquest Host] Round started:', data);
    els.gameStatus.textContent = `Vòng ${data.roundNumber}/${data.maxRounds}`;
    if (els.roundInfo) {
        els.roundInfo.textContent = `Round ${data.roundNumber}/${data.maxRounds}`;
    }
    startTimer(data.duration);
});

// Round timer
function startTimer(duration) {
    console.log('[Conquest Host] Starting timer with duration:', duration);
    if (timerInterval) clearInterval(timerInterval);
    let timeLeft = duration / 1000;

    if (els.timerValue) {
        els.timerValue.textContent = timeLeft;
        els.timerValue.classList.remove('warning'); // Reset warning state
        console.log('[Conquest Host] Timer element found, updating to:', timeLeft);
    } else {
        console.error('[Conquest Host] Timer element NOT FOUND!');
        return;
    }

    timerInterval = setInterval(() => {
        timeLeft--;
        els.timerValue.textContent = Math.max(0, timeLeft);

        // Add red warning when time is low
        if (timeLeft <= 3) {
            els.timerValue.classList.add('warning');
        } else {
            els.timerValue.classList.remove('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// Map update (after round ends) - sync event name with server
socket.on('conquestMapUpdate', (data) => {
    if (renderer && grid) {
        // Update grid with new ownership data
        if (data.grid) {
            for (let x = 0; x < 10; x++) {
                for (let y = 0; y < 10; y++) {
                    grid.setCell(x, y, data.grid[x][y]);
                }
            }
        }
        renderer.render();
    }
});

// Real-time player cell selection (during round)
socket.on('conquestPlayerCellUpdate', (data) => {
    if (renderer) {
        // Highlight the cell being selected/deselected by player
        const { x, y, action, playerNickname } = data;
        const cellEl = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cellEl) {
            if (action === 'add') {
                cellEl.classList.add('player-selecting');
                cellEl.setAttribute('data-player', playerNickname);
            } else {
                cellEl.classList.remove('player-selecting');
                cellEl.removeAttribute('data-player');
            }
        }
    }
});

// Round end
socket.on('conquestRoundEnd', (data) => {
    console.log('[Conquest Host] conquestRoundEnd received:', data);
    els.gameStatus.textContent = 'Vòng kết thúc!';
    els.nextBtn.style.display = 'block';
    console.log('[Conquest Host] nextBtn display set to block');
    if (data && data.leaderboard) {
        updateLeaderboard(data.leaderboard);
    }
});

// Next round
function nextRound() {
    socket.emit('conquestNextRound', { roomCode });
    els.nextBtn.style.display = 'none';
}

// Game over
socket.on('conquestGameOver', (data) => {
    els.gameStatus.textContent = '🎉 Trò Chơi Kết Thúc!';
    els.nextBtn.style.display = 'none';
    updateLeaderboard(data.finalLeaderboard);

    // Show "Chơi Lại" button
    if (!document.getElementById('resetBtn')) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'resetBtn';
        resetBtn.className = 'btn btn-primary';
        resetBtn.textContent = '🔄 Chơi Lại';
        resetBtn.style.marginTop = '15px';
        resetBtn.onclick = resetConquestRoom;
        els.startBtn.parentElement.appendChild(resetBtn);
    }
    document.getElementById('resetBtn').style.display = 'block';
});

// Reset conquest room (soft reset - keep players)
function resetConquestRoom() {
    socket.emit('resetConquestRoom', { roomCode });
}

// Room reset - return to waiting state
socket.on('conquestRoomReset', ({ players }) => {
    console.log('[Conquest Host] Room reset, players kept:', players.length);

    // Clear timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Reset UI
    els.gameStatus.textContent = 'Waiting for players...';
    els.timerValue.textContent = '5';
    els.timerValue.classList.remove('warning');
    if (els.roundInfo) {
        els.roundInfo.textContent = 'Round 1/12';
    }

    // Reset grid
    if (grid) {
        grid = new ConquestGrid(10);
        grid.initializeSpecialCells(8);
        renderer = new ConquestRenderer(els.gridContainer, grid, {
            large: true,
            clickable: false
        });
    }

    // Show start button, hide others
    els.startBtn.style.display = 'block';
    els.nextBtn.style.display = 'none';
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.style.display = 'none';

    // Update player count
    els.playerCount.textContent = players.length;
    updateLeaderboard(players);
});

// Update leaderboard
function updateLeaderboard(players) {
    const container = els.leaderboardList;
    if (!container) return;

    container.innerHTML = '';
    const sortedPlayers = players.sort((a, b) => (b.territory || 0) - (a.territory || 0));
    const top10 = sortedPlayers.slice(0, 10);

    top10.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';

        const rankBadge = document.createElement('div');
        rankBadge.className = 'rank-badge';
        rankBadge.textContent = `#${index + 1}`;

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.nickname;

        const score = document.createElement('div');
        score.className = 'player-score';
        score.textContent = player.territory || 0;

        item.appendChild(rankBadge);
        item.appendChild(name);
        item.appendChild(score);
        container.appendChild(item);
    });
}

// Cleanup function
function cleanupConquestHost() {
    // Clear timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Cleanup renderer
    if (renderer) {
        renderer = null;
    }

    // Cleanup grid
    if (grid) {
        grid = null;
    }

    // Remove socket listeners
    if (socket) {
        socket.removeAllListeners();
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupConquestHost);
