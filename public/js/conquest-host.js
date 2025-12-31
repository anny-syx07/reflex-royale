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
    timerValue: document.getElementById('timerValue'),
    startBtn: document.getElementById('startBtn'),
    nextBtn: document.getElementById('nextBtn'),
    leaderboardList: document.getElementById('leaderboardList'),
    roundInfo: document.getElementById('roundInfo')
};

// Create new room
function createRoom() {
    socket.emit('createConquestRoom');
}

// Room created
socket.on('conquestRoomCreated', (data) => {
    roomCode = data.roomCode;
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
});

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
    els.gameStatus.textContent = `Vòng ${data.roundNumber}/${data.maxRounds}`;
    els.roundInfo.textContent = `Thời gian: ${data.duration / 1000}s`;
    startTimer(data.duration);
});

// Round timer
function startTimer(duration) {
    if (timerInterval) clearInterval(timerInterval);
    let timeLeft = duration / 1000;
    els.timerValue.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        els.timerValue.textContent = Math.max(0, timeLeft);
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
    els.gameStatus.textContent = 'Vòng kết thúc!';
    els.nextBtn.style.display = 'block';
    updateLeaderboard(data.leaderboard);
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
    // Host controls when to leave - no auto-redirect
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
