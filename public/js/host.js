const socket = io();

let roomCode = null;
let currentRoundType = null;
let roundTimer = null;
let globalTimer = null;
let roundTimeLeft = 0;

// Game state
const gameState = {
    phase: 'WAITING',
    roundNumber: 0,
    totalRounds: 7
};

// DOM Elements
const waitingScreen = document.getElementById('waitingScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const roomCodeEl = document.getElementById('roomCode');
const playerCountEl = document.getElementById('playerCount');
const playerListEl = document.getElementById('playerList');
const startGameBtn = document.getElementById('startGameBtn');
const currentRoundEl = document.getElementById('currentRound');
const totalRoundsEl = document.getElementById('totalRounds');
const roundDisplayEl = document.getElementById('roundDisplay');
const leaderboardEl = document.getElementById('leaderboard');
const finalLeaderboardEl = document.getElementById('finalLeaderboard');
const newGameBtn = document.getElementById('newGameBtn');
const timerValueEl = document.getElementById('timerValue');
const nextRoundBtn = document.getElementById('nextRoundBtn');

// Initialize - Create room on load
socket.emit('createRoom');

// Room created
socket.on('roomCreated', ({ roomCode: code }) => {
    roomCode = code;
    roomCodeEl.textContent = code;
    console.log('Room created:', code);
});

// Player list update
socket.on('playerListUpdate', ({ players }) => {
    playerCountEl.textContent = players.length;

    playerListEl.innerHTML = '';
    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.textContent = player.nickname;
        playerListEl.appendChild(playerCard);
    });

    // Enable start button if at least 1 player
    startGameBtn.disabled = players.length === 0;
});

// Start game
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomCode });
});

// Next round button
nextRoundBtn.addEventListener('click', () => {
    socket.emit('nextRound', { roomCode });
});

// Game started
socket.on('gameStarted', () => {
    waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

// Round start
socket.on('roundStart', ({ roundNumber, totalRounds, roundType, roundData, startTime }) => {
    currentRoundEl.textContent = roundNumber;
    totalRoundsEl.textContent = totalRounds;
    currentRoundType = roundType;

    // Clear previous round display
    roundDisplayEl.innerHTML = '';

    // Clear any existing timers
    if (globalTimer) clearInterval(globalTimer);
    if (roundTimer) clearInterval(roundTimer);

    // Display based on round type
    if (roundType === 'COLOR_TAP') {
        displayColorRound(roundData.color);
        startGlobalTimer(5); // 5 seconds for color tap
    } else if (roundType === 'SWIPE') {
        displaySwipeRound(roundData.direction);
        startGlobalTimer(5); // 5 seconds for swipe
    } else if (roundType === 'SHAKE') {
        displayShakeRound(roundData.duration);
        startGlobalTimer(roundData.duration / 1000);
    } else if (roundType === 'TAP_SPAM') {
        displayTapSpamRound(roundData.duration);
        startGlobalTimer(roundData.duration / 1000);
    }
});

// Global timer function for header
function startGlobalTimer(seconds) {
    roundTimeLeft = seconds;
    timerValueEl.textContent = roundTimeLeft;

    globalTimer = setInterval(() => {
        roundTimeLeft--;
        timerValueEl.textContent = Math.max(0, roundTimeLeft);

        if (roundTimeLeft <= 0) {
            clearInterval(globalTimer);
        }
    }, 1000);
}

// Display color round
function displayColorRound(color) {
    const colorNames = {
        RED: 'ĐỎ',
        BLUE: 'XANH',
        YELLOW: 'VÀNG',
        PURPLE: 'TÍM'
    };

    const colorDisplay = document.createElement('div');
    colorDisplay.className = `color-display color-${color}`;
    colorDisplay.innerHTML = `
        ${colorNames[color]}
        <div class="instruction-text">Chạm vào màu này!</div>
    `;
    roundDisplayEl.appendChild(colorDisplay);
}

// Display swipe round
function displaySwipeRound(direction) {
    const arrows = {
        UP: '⬆️',
        DOWN: '⬇️',
        LEFT: '⬅️',
        RIGHT: '➡️'
    };

    const directionNames = {
        UP: 'LÊN',
        DOWN: 'XUỐNG',
        LEFT: 'TRÁI',
        RIGHT: 'PHẢI'
    };

    const arrowDisplay = document.createElement('div');
    arrowDisplay.className = 'arrow-display';
    arrowDisplay.innerHTML = `
        <div>${arrows[direction]}</div>
        <div style="font-size: 2rem; margin-top: 20px;">Vuốt ${directionNames[direction]}!</div>
    `;
    roundDisplayEl.appendChild(arrowDisplay);
}

// Display shake round
function displayShakeRound(duration) {
    const shakeDisplay = document.createElement('div');
    shakeDisplay.className = 'shake-display';
    shakeDisplay.innerHTML = `
    <h2>🥊 LẮC ĐIỆN THOẠI! 🥊</h2>
    <div class="energy-bar-container">
      <div class="energy-bar" id="energyBar" style="width: 0%"></div>
      <div class="energy-text" id="energyText">0 / 0</div>
    </div>
    <div class="countdown" id="countdown">${duration / 1000}</div>
  `;
    roundDisplayEl.appendChild(shakeDisplay);

    // Countdown timer
    let timeLeft = duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// Display tap spam round
function displayTapSpamRound(duration) {
    const tapDisplay = document.createElement('div');
    tapDisplay.className = 'tap-display';
    tapDisplay.innerHTML = `
    <h2>👆 CHẠM LIÊN TỤC! 👆</h2>
    <div class="tap-button-demo">GO!</div>
    <div class="countdown" id="countdown">${duration / 1000}</div>
  `;
    roundDisplayEl.appendChild(tapDisplay);

    // Countdown timer
    let timeLeft = duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// Energy bar update (for shake round)
socket.on('energyBarUpdate', ({ totalShakes, maxShakes }) => {
    const energyBar = document.getElementById('energyBar');
    const energyText = document.getElementById('energyText');

    if (energyBar && energyText) {
        const percentage = Math.min(100, (totalShakes / maxShakes) * 100);
        energyBar.style.width = percentage + '%';
        energyText.textContent = `${totalShakes} / ${maxShakes}`;
    }
});

// Leaderboard update
socket.on('leaderboardUpdate', ({ leaderboard }) => {
    leaderboardEl.innerHTML = '';

    leaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
      <div class="rank rank-${index + 1}">#${index + 1}</div>
      <div class="player-name">${player.nickname}</div>
      <div class="player-score">${player.score}</div>
    `;
        leaderboardEl.appendChild(item);
    });
});

// Round end
socket.on('roundEnd', () => {
    if (roundTimer) {
        clearInterval(roundTimer);
    }
    if (globalTimer) {
        clearInterval(globalTimer);
    }

    // Display "Round Complete" message
    timerValueEl.textContent = '✓';

    // Auto-advance to next round after 3 seconds (host can also manually advance)
    setTimeout(() => {
        socket.emit('nextRound', { roomCode });
    }, 3000);
});

// Game over
socket.on('gameOver', ({ finalLeaderboard }) => {
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    finalLeaderboardEl.innerHTML = '';

    finalLeaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
      <div class="rank rank-${index + 1}">#${index + 1}</div>
      <div class="player-name">${player.nickname}</div>
      <div class="player-score">${player.score} điểm</div>
    `;
        finalLeaderboardEl.appendChild(item);
    });
    // Host controls when to leave - no auto-redirect
});

// New game
newGameBtn.addEventListener('click', () => {
    cleanupHost();
    window.location.href = '/host.html';
});

// Host disconnected
socket.on('hostDisconnected', () => {
    alert('Host đã ngắt kết nối!');
    cleanupHost();
    location.reload();
});

// Cleanup function
function cleanupHost() {
    // Clear all timers
    if (globalTimer) clearInterval(globalTimer);
    if (roundTimer) clearInterval(roundTimer);
    globalTimer = null;
    roundTimer = null;

    // Remove socket listeners
    if (socket) {
        socket.removeAllListeners();
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupHost);
