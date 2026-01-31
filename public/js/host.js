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

// Check for existing room to reconnect
const savedRoomCode = localStorage.getItem('reflexHostRoom');
if (savedRoomCode) {
    console.log('[Host] Found saved room:', savedRoomCode);
    socket.emit('reconnectHost', { roomCode: savedRoomCode });
} else {
    // No saved room, create new one
    socket.emit('createRoom');
}

// Handle reconnection result
socket.on('reconnectResult', ({ success, roomCode: code, gameState: state, players, message }) => {
    if (success) {
        console.log('[Host] Reconnected to room:', code);
        roomCode = code;
        roomCodeEl.textContent = code;

        // Update player list
        if (players) {
            playerCountEl.textContent = players.length;
            playerListEl.innerHTML = '';
            players.forEach(player => {
                const playerCard = document.createElement('div');
                playerCard.className = 'player-card';
                playerCard.innerHTML = `
                    <div class="avatar-container">
                        <img src="${player.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(player.nickname)}`}" alt="Avatar" class="player-avatar">
                    </div>
                `;
                const nameEl = document.createElement('div');
                nameEl.textContent = player.nickname;
                playerCard.appendChild(nameEl);
                playerListEl.appendChild(playerCard);
            });
            startGameBtn.disabled = players.length === 0;
        }

        // Restore game state
        if (state === 'WAITING') {
            waitingScreen.classList.remove('hidden');
            gameScreen.classList.add('hidden');
            gameOverScreen.classList.add('hidden');
        } else if (state === 'PLAYING') {
            waitingScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');
        } else if (state === 'FINISHED') {
            waitingScreen.classList.add('hidden');
            gameScreen.classList.add('hidden');
            gameOverScreen.classList.remove('hidden');
        }

        // Generate QR code
        generateQRCode(code);
    } else {
        console.log('[Host] Could not reconnect:', message);
        localStorage.removeItem('reflexHostRoom');
        socket.emit('createRoom');
    }
});

// Room created
socket.on('roomCreated', ({ roomCode: code }) => {
    roomCode = code;
    roomCodeEl.textContent = code;
    localStorage.setItem('reflexHostRoom', code);
    console.log('Room created:', code);

    // Generate QR code
    generateQRCode(code);
});

// Generate QR code for room
function generateQRCode(code) {
    const canvas = document.getElementById('qrCode');
    if (!canvas || typeof QRCode === 'undefined') {
        console.log('[Host] QR Code generation skipped - canvas or library not found');
        return;
    }

    const playerUrl = `${window.location.origin}/player.html?roomCode=${code}`;

    QRCode.toCanvas(canvas, playerUrl, {
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'L',
        color: {
            dark: '#667eea',
            light: '#ffffff'
        }
    }, (error) => {
        if (error) {
            console.error('[Host] QR Code error:', error);
        } else {
            console.log('[Host] QR Code generated for:', playerUrl);
        }
    });
}

// Player list update
socket.on('playerListUpdate', ({ players }) => {
    playerCountEl.textContent = players.length;

    playerListEl.innerHTML = '';
    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
            <div class="avatar-container">
                <img src="${player.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(player.nickname)}`}" alt="Avatar" class="player-avatar">
            </div>
        `;
        const nameEl = document.createElement('div');
        nameEl.textContent = player.nickname;
        playerCard.appendChild(nameEl);
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
    // Check if it's the final round
    const currentRound = parseInt(currentRoundEl.textContent);
    const totalRounds = parseInt(totalRoundsEl.textContent);

    if (currentRound >= totalRounds) {
        // Last round - skip delay and go straight to game over
        socket.emit('nextRound', { roomCode });
        return;
    }

    // Hide round display, Show leaderboard
    document.getElementById('roundDisplay').style.display = 'none';
    document.querySelector('.leaderboard-container').classList.remove('hidden');

    // Hide the button itself to prevent double clicks
    nextRoundBtn.style.display = 'none';

    // Wait 5 seconds then start next round
    let secondsLeft = 5;
    const timerDisplay = document.getElementById('timerValue');
    timerDisplay.textContent = secondsLeft;

    const countdown = setInterval(() => {
        secondsLeft--;
        timerDisplay.textContent = secondsLeft;

        if (secondsLeft <= 0) {
            clearInterval(countdown);
            socket.emit('nextRound', { roomCode });
        }
    }, 1000);
});

// Game started
socket.on('gameStarted', () => {
    waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    // Ensure leaderboard is hidden initially
    document.querySelector('.leaderboard-container').classList.add('hidden');
});

// Round start
socket.on('roundStart', ({ roundNumber, totalRounds, roundType, roundData, startTime }) => {
    currentRoundEl.textContent = roundNumber;
    totalRoundsEl.textContent = totalRounds;
    currentRoundType = roundType;

    // Reset UI for new round
    document.querySelector('.leaderboard-container').classList.add('hidden');
    document.getElementById('roundDisplay').style.display = 'flex'; // Restore flex display

    // Hide next round button when round starts
    nextRoundBtn.style.display = 'none';

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
    } else if (roundType === 'DONT_TAP') {
        displayDontTapRound(roundData);
        startGlobalTimer(roundData.duration / 1000);
    } else if (roundType === 'QUICK_MATH') {
        displayQuickMathRound(roundData);
        startGlobalTimer(roundData.duration / 1000);
    } else if (roundType === 'GYRO_BALANCE') {
        displayGyroBalanceRound(roundData);
        startGlobalTimer(roundData.duration / 1000);
    } else if (roundType === 'ICON_HUNT') {
        displayIconHuntRound(roundData);
        startGlobalTimer(roundData.duration / 1000);
    } else if (roundType === 'SOUND_CHECK') {
        displaySoundCheckRound(roundData);
        startGlobalTimer(roundData.duration / 1000);
    } else if (roundType === 'FINAL_BLITZ') {
        displayFinalBlitzRound(roundData);
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

// ============== ROUND 5: DON'T TAP ==============
function displayDontTapRound(roundData) {
    const dontTapDisplay = document.createElement('div');
    dontTapDisplay.className = 'dont-tap-display';

    if (roundData.isBomb) {
        dontTapDisplay.innerHTML = `
            <div class="trap-indicator bomb">
                <div class="trap-emoji">💣</div>
                <h2>ĐỪNG CHẠM!</h2>
                <p>Ai chạm sẽ bị trừ -500 điểm!</p>
            </div>
            <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
        `;
    } else {
        dontTapDisplay.innerHTML = `
            <div class="trap-indicator safe">
                <div class="trap-emoji">✅</div>
                <h2>CHẠM NGAY!</h2>
                <p>Nhanh tay để được điểm cao!</p>
            </div>
            <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
        `;
    }

    roundDisplayEl.appendChild(dontTapDisplay);

    // Countdown timer
    let timeLeft = roundData.duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// ============== ROUND 6: QUICK MATH ==============
function displayQuickMathRound(roundData) {
    const mathDisplay = document.createElement('div');
    mathDisplay.className = 'quick-math-display';

    const taskText = roundData.task === 'MIN' ? 'SỐ NHỎ NHẤT' : 'SỐ LỚN NHẤT';

    mathDisplay.innerHTML = `
        <h2>🧮 TÌM ${taskText}!</h2>
        <div class="number-display">
            ${roundData.numbers.map(n => `<span class="number-box">${n}</span>`).join('')}
        </div>
        <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
    `;

    roundDisplayEl.appendChild(mathDisplay);

    // Countdown timer
    let timeLeft = roundData.duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// ============== ROUND 7: GYRO BALANCE ==============
function displayGyroBalanceRound(roundData) {
    const balanceDisplay = document.createElement('div');
    balanceDisplay.className = 'gyro-balance-display';

    balanceDisplay.innerHTML = `
        <h2>⚖️ GIỮ THĂNG BẰNG!</h2>
        <div class="balance-demo">
            <div class="balance-circle">
                <div class="balance-target-demo"></div>
                <div class="balance-cross">+</div>
            </div>
        </div>
        <p>Giữ điện thoại thật phẳng để ghi điểm!</p>
        <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
    `;

    roundDisplayEl.appendChild(balanceDisplay);

    // Countdown timer
    let timeLeft = roundData.duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// ============== ROUND 8: ICON HUNT ==============
function displayIconHuntRound(roundData) {
    const iconHuntDisplay = document.createElement('div');
    iconHuntDisplay.className = 'icon-hunt-display';

    iconHuntDisplay.innerHTML = `
        <h2>🔍 TÌM: <span class="target-icon-large">${roundData.targetIcon}</span></h2>
        <div class="icon-grid-demo">
            ${roundData.gridIcons.map((icon, i) =>
        `<span class="grid-icon ${i === roundData.targetPosition ? 'target' : ''}">${icon}</span>`
    ).join('')}
        </div>
        <p>Tìm icon mục tiêu trong lưới 4x4!</p>
        <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
    `;

    roundDisplayEl.appendChild(iconHuntDisplay);

    // Countdown timer
    let timeLeft = roundData.duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// ============== ROUND 9: SOUND CHECK ==============
function displaySoundCheckRound(roundData) {
    const soundCheckDisplay = document.createElement('div');
    soundCheckDisplay.className = 'sound-check-display';

    soundCheckDisplay.innerHTML = `
        <h2>🔊 PHẢN XẠ ÂM THANH!</h2>
        <div class="sound-playing">
            <audio id="hostSoundAudio" src="${roundData.correctSound.audio}" preload="auto"></audio>
            <button id="hostPlayBtn" class="host-play-btn">🔊 PHÁT ÂM THANH</button>
        </div>
        <p class="sound-hint">Nghe và chọn hình ảnh phù hợp!</p>
        <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
    `;

    roundDisplayEl.appendChild(soundCheckDisplay);

    // Host play button
    const hostPlayBtn = document.getElementById('hostPlayBtn');
    const hostAudio = document.getElementById('hostSoundAudio');

    if (hostPlayBtn && hostAudio) {
        hostPlayBtn.onclick = () => {
            hostAudio.play();
            hostPlayBtn.textContent = '🔊 ĐANG PHÁT...';
            hostAudio.onended = () => {
                hostPlayBtn.textContent = '🔊 PHÁT LẠI';
            };
        };
        // Auto-play
        setTimeout(() => hostAudio.play(), 500);
    }

    // Countdown timer
    let timeLeft = roundData.duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
        }
    }, 1000);
}

// ============== ROUND 10: FINAL BLITZ ==============
function displayFinalBlitzRound(roundData) {
    const blitzDisplay = document.createElement('div');
    blitzDisplay.className = 'final-blitz-display';

    blitzDisplay.innerHTML = `
        <div class="blitz-header-host">
            <h2>⚡ VỀ ĐÍCH! ⚡</h2>
            <div class="blitz-multiplier">ĐIỂM x2</div>
        </div>
        <div class="blitz-info">
            <p>10 thử thách liên tiếp</p>
            <p>Tốc độ siêu nhanh!</p>
        </div>
        <div class="blitz-challenge-preview" id="blitzPreview">
            Đang chờ...
        </div>
        <div class="countdown" id="countdown">${roundData.duration / 1000}</div>
    `;

    roundDisplayEl.appendChild(blitzDisplay);

    // Show challenge progression
    let currentChallenge = 0;
    const previewEl = document.getElementById('blitzPreview');

    const challengeTimer = setInterval(() => {
        if (currentChallenge >= roundData.challenges.length) {
            clearInterval(challengeTimer);
            previewEl.textContent = 'HOÀN THÀNH!';
            return;
        }

        const challenge = roundData.challenges[currentChallenge];
        let displayText = '';

        if (challenge.type === 'COLOR') {
            const colorNames = { RED: 'ĐỎ', BLUE: 'XANH', YELLOW: 'VÀNG', PURPLE: 'TÍM' };
            displayText = `🎨 CHẠM: ${colorNames[challenge.color]}`;
        } else if (challenge.type === 'SWIPE') {
            const arrows = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
            displayText = `${arrows[challenge.direction]} VUỐT`;
        } else if (challenge.type === 'TAP') {
            displayText = '👆 CHẠM!';
        } else if (challenge.type === 'MATH') {
            displayText = `🔢 ${challenge.task === 'MIN' ? 'SỐ NHỎ NHẤT' : 'SỐ LỚN NHẤT'}`;
        }

        previewEl.innerHTML = `<strong>${currentChallenge + 1}/10:</strong> ${displayText}`;
        currentChallenge++;
    }, roundData.challengeDuration);

    // Countdown timer
    let timeLeft = roundData.duration / 1000;
    const countdownEl = document.getElementById('countdown');

    roundTimer = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimer);
            clearInterval(challengeTimer);
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
      <div class="leaderboard-avatar-container">
          <img src="${player.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(player.nickname)}`}" alt="Avatar" class="player-avatar">
      </div>
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

    // Show next round button - host must click to advance
    nextRoundBtn.style.display = 'inline-block';
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
       <div class="leaderboard-avatar-container">
          <img src="${player.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(player.nickname)}`}" alt="Avatar" class="player-avatar">
      </div>
      <div class="player-name">${player.nickname}</div>
      <div class="player-score">${player.score} điểm</div>
    `;
        finalLeaderboardEl.appendChild(item);
    });
    // Host controls when to leave - no auto-redirect

    // Start confetti effect
    startConfetti();
});

// New game - Soft reset (keep players)
newGameBtn.addEventListener('click', () => {
    socket.emit('resetRoom', { roomCode });
});

// Room reset - return to waiting screen with players intact
socket.on('roomReset', ({ players }) => {
    console.log('[Host] Room reset, players kept:', players.length);

    // Clear timers
    if (globalTimer) clearInterval(globalTimer);
    if (roundTimer) clearInterval(roundTimer);
    globalTimer = null;
    roundTimer = null;

    // Reset UI
    gameOverScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');

    // Update player list
    playerCountEl.textContent = players.length;
    playerListEl.innerHTML = '';
    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
            <div class="avatar-container">
                <img src="${player.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(player.nickname)}`}" alt="Avatar" class="player-avatar">
            </div>
        `;
        const nameEl = document.createElement('div');
        nameEl.textContent = player.nickname;
        playerCard.appendChild(nameEl);
        playerListEl.appendChild(playerCard);
    });

    // Enable start button
    startGameBtn.disabled = players.length === 0;
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

// Confetti Waterfall Effect
function startConfetti() {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const container = document.getElementById('gameOverScreen');

    // Create confetti generator
    const interval = setInterval(() => {
        if (!container.classList.contains('hidden')) {
            createConfetti(container);
        } else {
            clearInterval(interval);
        }
    }, 50); // New confetti every 50ms

    // Store interval to clear later if needed
    window.confettiInterval = interval;
}

function createConfetti(container) {
    const confetti = document.createElement('div');
    confetti.innerHTML = '🎉';
    confetti.className = 'confetti';

    // Random positioning and styling
    const left = Math.random() * 100;
    const duration = Math.random() * 3 + 2; // 2-5 seconds
    const size = Math.random() * 20 + 20; // 20-40px

    confetti.style.left = `${left}%`;
    confetti.style.animationDuration = `${duration}s`;
    confetti.style.fontSize = `${size}px`;

    container.appendChild(confetti);

    // Remove after animation
    setTimeout(() => {
        confetti.remove();
    }, duration * 1000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupHost);
