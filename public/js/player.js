const socket = io();

let roomCode = null;
let playerId = null;
let currentScore = 0;
let currentRoundType = null;
let roundStartTime = null;

// Shake detection variables
let shakeCount = 0;
let lastShakeTime = 0;
let shakeInterval = null;

// Tap spam variables
let tapCount = 0;

// Swipe detection variables
let touchStartX = 0;
let touchStartY = 0;

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const waitingScreen = document.getElementById('waitingScreen');
const gameScreen = document.getElementById('gameScreen');
const roomCodeInput = document.getElementById('roomCodeInput');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const errorMessage = document.getElementById('errorMessage');
const colorButtons = document.getElementById('colorButtons');
const swipeArea = document.getElementById('swipeArea');
const swipeIndicator = document.getElementById('swipeIndicator');
const shakeArea = document.getElementById('shakeArea');
const shakeCountEl = document.getElementById('shakeCount');
const tapSpamArea = document.getElementById('tapSpamArea');
const tapSpamBtn = document.getElementById('tapSpamBtn');
const tapCountEl = document.getElementById('tapCount');
const scoreValue = document.getElementById('scoreValue');
const feedback = document.getElementById('feedback');

// Auto-join from URL params
const urlParams = new URLSearchParams(window.location.search);
const urlRoomCode = urlParams.get('roomCode');
const urlNickname = urlParams.get('nickname');

if (urlRoomCode && urlNickname) {
    roomCodeInput.value = urlRoomCode;
    nicknameInput.value = urlNickname;
    setTimeout(() => joinBtn.click(), 500);
}

// Join room
joinBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    const nickname = nicknameInput.value.trim() || 'Player' + Math.floor(Math.random() * 1000);

    if (!code || code.length !== 4) {
        showError('Vui lòng nhập mã phòng 4 số!');
        return;
    }

    socket.emit('joinRoom', { roomCode: code, nickname });
});

// Enter key to join
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

// Show error
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 3000);
}

// Joined room successfully
socket.on('joinedRoom', ({ roomCode: code, playerId: id }) => {
    roomCode = code;
    playerId = id;
    document.body.classList.add('in-game'); // Hide back button
    joinScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    console.log('Joined room:', code);
});

// Error joining
socket.on('error', ({ message }) => {
    showError(message);
});

// Game started
socket.on('gameStarted', () => {
    waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

// Round start
socket.on('roundStart', ({ roundType, roundData, startTime }) => {
    currentRoundType = roundType;
    roundStartTime = startTime;

    // Hide all game areas
    colorButtons.classList.add('hidden');
    swipeArea.classList.add('hidden');
    shakeArea.classList.add('hidden');
    tapSpamArea.classList.add('hidden');

    // Reset counters
    shakeCount = 0;
    tapCount = 0;
    shakeCountEl.textContent = '0';
    tapCountEl.textContent = '0';

    // Show appropriate interface
    if (roundType === 'COLOR_TAP') {
        colorButtons.classList.remove('hidden');
    } else if (roundType === 'SWIPE') {
        swipeArea.classList.remove('hidden');
        setupSwipeDetection();
    } else if (roundType === 'SHAKE') {
        shakeArea.classList.remove('hidden');
        setupShakeDetection();
    } else if (roundType === 'TAP_SPAM') {
        tapSpamArea.classList.remove('hidden');
        setupTapSpam();
    }
});

// Color button clicks
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (currentRoundType !== 'COLOR_TAP') return;

        const color = e.target.dataset.color;
        sendResponse(color);

        // Visual feedback
        e.target.style.transform = 'scale(0.9)';
        setTimeout(() => {
            e.target.style.transform = 'scale(1)';
        }, 100);
    });
});

// Setup swipe detection
function setupSwipeDetection() {
    swipeArea.addEventListener('touchstart', handleSwipeStart, { passive: false });
    swipeArea.addEventListener('touchmove', handleSwipeMove, { passive: false });
    swipeArea.addEventListener('touchend', handleSwipeEnd, { passive: false });
}

function handleSwipeStart(e) {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}

function handleSwipeMove(e) {
    e.preventDefault();
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    // Show swipe indicator
    if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
        let direction = '';
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? '➡️' : '⬅️';
        } else {
            direction = deltaY > 0 ? '⬇️' : '⬆️';
        }
        swipeIndicator.textContent = direction;
        swipeIndicator.classList.add('show');
    }
}

function handleSwipeEnd(e) {
    e.preventDefault();
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    const minSwipeDistance = 50;
    let direction = null;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > minSwipeDistance) {
            direction = deltaX > 0 ? 'RIGHT' : 'LEFT';
        }
    } else {
        if (Math.abs(deltaY) > minSwipeDistance) {
            direction = deltaY > 0 ? 'DOWN' : 'UP';
        }
    }

    if (direction) {
        sendResponse(direction);
    }

    // Hide indicator
    setTimeout(() => {
        swipeIndicator.classList.remove('show');
    }, 300);
}

// Setup shake detection
function setupShakeDetection() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS 13+ requires permission
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('devicemotion', handleShake);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('devicemotion', handleShake);
    }

    // Send shake count updates periodically
    shakeInterval = setInterval(() => {
        if (currentRoundType === 'SHAKE') {
            socket.emit('shakeUpdate', { roomCode, shakeCount });
        }
    }, 200);
}

function handleShake(event) {
    if (currentRoundType !== 'SHAKE') return;

    const acceleration = event.accelerationIncludingGravity;
    const threshold = 15;
    const now = Date.now();

    if (now - lastShakeTime < 100) return; // Debounce

    if (
        Math.abs(acceleration.x) > threshold ||
        Math.abs(acceleration.y) > threshold ||
        Math.abs(acceleration.z) > threshold
    ) {
        shakeCount++;
        shakeCountEl.textContent = shakeCount;
        lastShakeTime = now;

        // Haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }
}

// Setup tap spam
function setupTapSpam() {
    tapCount = 0;
    tapCountEl.textContent = '0';

    tapSpamBtn.addEventListener('click', handleTapSpam);

    // Send tap count updates periodically
    const tapInterval = setInterval(() => {
        if (currentRoundType === 'TAP_SPAM') {
            socket.emit('tapUpdate', { roomCode, tapCount });
        } else {
            clearInterval(tapInterval);
        }
    }, 200);
}

function handleTapSpam() {
    if (currentRoundType !== 'TAP_SPAM') return;

    tapCount++;
    tapCountEl.textContent = tapCount;

    // Haptic feedback if available
    if (navigator.vibrate) {
        navigator.vibrate(10);
    }
}

// Send response to server
function sendResponse(response) {
    const timestamp = Date.now();
    socket.emit('playerResponse', { roomCode, response, timestamp });
}

// Response result
socket.on('responseResult', ({ correct, points, totalScore }) => {
    currentScore = totalScore;
    scoreValue.textContent = currentScore;

    // Show feedback
    if (correct !== undefined) {
        feedback.textContent = correct ? `+${points} ✓` : `${points} ✗`;
        feedback.className = correct ? 'feedback correct' : 'feedback incorrect';
        feedback.classList.remove('hidden');

        setTimeout(() => {
            feedback.classList.add('hidden');
        }, 1500);
    }

    // Haptic feedback
    if (navigator.vibrate) {
        navigator.vibrate(correct ? [50] : [50, 50, 50]);
    }
});

// Round end
socket.on('roundEnd', () => {
    // Clear event listeners and intervals
    if (shakeInterval) {
        clearInterval(shakeInterval);
        shakeInterval = null;
    }

    window.removeEventListener('devicemotion', handleShake);

    // Hide all game areas temporarily
    colorButtons.classList.add('hidden');
    swipeArea.classList.add('hidden');
    shakeArea.classList.add('hidden');
    tapSpamArea.classList.add('hidden');
});

// Game over
socket.on('gameOver', ({ finalLeaderboard }) => {
    const playerRank = finalLeaderboard.findIndex(p => p.id === playerId) + 1;
    const totalPlayers = finalLeaderboard.length;

    gameScreen.innerHTML = `
    <div class="container">
      <h1 class="game-title text-gradient">🎉 HOÀN THÀNH! 🎉</h1>
      <div class="glass" style="padding: 2rem; border-radius: 1rem; text-align: center;">
        <h2 style="font-size: 3rem; color: var(--color-yellow); margin-bottom: 1rem;">
          #${playerRank} / ${totalPlayers}
        </h2>
        <p style="font-size: 1.5rem; color: var(--text-secondary);">
          Tổng điểm: <strong style="color: var(--color-yellow);">${currentScore}</strong>
        </p>
        <button class="btn btn-primary btn-lg" onclick="window.location.href='/player.html'" style="margin-top: 2rem;">
          🎮 CHƠI LẠI
        </button>
      </div>
    </div>
  `;
    // No auto-redirect - player clicks button
});

// Host disconnected
socket.on('hostDisconnected', () => {
    alert('Host đã ngắt kết nối!');
    location.reload();
});
