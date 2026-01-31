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

// DON'T TAP variables
let dontTapTouched = false;

// QUICK MATH variables
let mathAnswered = false;

// GYRO BALANCE variables
let balanceInterval = null;
let balanceScore = 0;

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

// New round DOM elements
const dontTapArea = document.getElementById('dontTapArea');
const trapZone = document.getElementById('trapZone');
const trapIcon = document.getElementById('trapIcon');
const trapText = document.getElementById('trapText');
const trapLabel = document.getElementById('trapLabel');
const quickMathArea = document.getElementById('quickMathArea');
const mathTask = document.getElementById('mathTask');
const numberGrid = document.getElementById('numberGrid');
const gyroBalanceArea = document.getElementById('gyroBalanceArea');
const balanceIndicator = document.getElementById('balanceIndicator');
const balanceScoreDisplay = document.getElementById('balanceScoreDisplay');

// Round 8 & 9 DOM elements
const iconHuntArea = document.getElementById('iconHuntArea');
const targetIconDisplay = document.getElementById('targetIconDisplay');
const iconGrid = document.getElementById('iconGrid');
const freezeOverlay = document.getElementById('freezeOverlay');
const finalBlitzArea = document.getElementById('finalBlitzArea');
const blitzChallengeCount = document.getElementById('blitzChallengeCount');
const blitzChallengeContainer = document.getElementById('blitzChallengeContainer');

// Blitz variables
let blitzCurrentChallenge = 0;
let blitzChallenges = [];
let blitzTimer = null;

// Sound check DOM elements
const soundCheckArea = document.getElementById('soundCheckArea');
const playSoundBtn = document.getElementById('playSoundBtn');
const soundAudio = document.getElementById('soundAudio');
const soundOptions = document.getElementById('soundOptions');

// Auto-join from URL params
const urlParams = new URLSearchParams(window.location.search);
const urlRoomCode = urlParams.get('roomCode');
const urlNickname = urlParams.get('nickname');
const urlAvatar = urlParams.get('avatar');

if (urlRoomCode && urlNickname) {
    roomCodeInput.value = urlRoomCode;
    nicknameInput.value = urlNickname;
    setTimeout(() => joinBtn.click(), 500);
}

// Join room
joinBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    const nickname = nicknameInput.value.trim() || 'Player' + Math.floor(Math.random() * 1000);
    // Use URL param avatar or generate one if missing (fallback)
    const avatar = urlAvatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(nickname)}`;

    if (!code || code.length !== 4) {
        showError('Vui lòng nhập mã phòng 4 số!');
        return;
    }

    socket.emit('joinRoom', { roomCode: code, nickname, avatar });
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
    if (dontTapArea) dontTapArea.classList.add('hidden');
    if (quickMathArea) quickMathArea.classList.add('hidden');
    if (gyroBalanceArea) gyroBalanceArea.classList.add('hidden');
    if (iconHuntArea) iconHuntArea.classList.add('hidden');
    if (soundCheckArea) soundCheckArea.classList.add('hidden');
    if (finalBlitzArea) finalBlitzArea.classList.add('hidden');

    // Reset counters
    shakeCount = 0;
    tapCount = 0;
    dontTapTouched = false;
    mathAnswered = false;
    balanceScore = 0;
    blitzCurrentChallenge = 0;
    blitzChallenges = [];
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
    } else if (roundType === 'DONT_TAP') {
        setupDontTap(roundData);
    } else if (roundType === 'QUICK_MATH') {
        setupQuickMath(roundData);
    } else if (roundType === 'GYRO_BALANCE') {
        setupGyroBalance(roundData);
    } else if (roundType === 'ICON_HUNT') {
        setupIconHunt(roundData);
    } else if (roundType === 'SOUND_CHECK') {
        setupSoundCheck(roundData);
    } else if (roundType === 'FINAL_BLITZ') {
        setupFinalBlitz(roundData);
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

// ============== ROUND 5: DON'T TAP ==============
function setupDontTap(roundData) {
    if (!dontTapArea) return;

    dontTapArea.classList.remove('hidden');
    dontTapTouched = false;

    // Update UI based on whether it's a bomb or tap command
    if (roundData.isBomb) {
        trapIcon.textContent = '💣';
        trapText.textContent = 'ĐỪNG CHẠM!';
        trapLabel.textContent = 'Giữ yên tay!';
        trapZone.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
    } else {
        trapIcon.textContent = '✅';
        trapText.textContent = 'CHẠM NGAY!';
        trapLabel.textContent = 'Nhanh tay!';
        trapZone.style.background = 'linear-gradient(135deg, #44ff44, #00cc00)';
    }

    // Handle tap on trap zone
    const handleTrapTap = (e) => {
        if (currentRoundType !== 'DONT_TAP' || dontTapTouched) return;
        e.preventDefault();
        dontTapTouched = true;

        // Visual feedback
        trapZone.style.transform = 'scale(0.95)';
        setTimeout(() => trapZone.style.transform = 'scale(1)', 100);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(roundData.isBomb ? [100, 50, 100] : [50]);
        }

        sendResponse('TAPPED');
    };

    trapZone.addEventListener('touchstart', handleTrapTap, { passive: false });
    trapZone.addEventListener('click', handleTrapTap);

    // When round ends, if they didn't tap, send HELD
    setTimeout(() => {
        if (currentRoundType === 'DONT_TAP' && !dontTapTouched) {
            sendResponse('HELD');
        }
        trapZone.removeEventListener('touchstart', handleTrapTap);
        trapZone.removeEventListener('click', handleTrapTap);
    }, roundData.duration - 100);
}

// ============== ROUND 6: QUICK MATH ==============
function setupQuickMath(roundData) {
    if (!quickMathArea || !numberGrid) return;

    quickMathArea.classList.remove('hidden');
    mathAnswered = false;

    // Update task text
    if (roundData.task === 'MIN') {
        mathTask.textContent = 'Chọn số NHỎ NHẤT';
    } else {
        mathTask.textContent = 'Chọn số LỚN NHẤT';
    }

    // Clear and create number buttons
    numberGrid.innerHTML = '';

    // Shuffle the numbers for random positions
    const shuffledNumbers = [...roundData.numbers].sort(() => Math.random() - 0.5);

    shuffledNumbers.forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'number-btn';
        btn.textContent = num;
        btn.addEventListener('click', () => {
            if (mathAnswered || currentRoundType !== 'QUICK_MATH') return;
            mathAnswered = true;

            // Visual feedback
            btn.style.transform = 'scale(0.9)';
            const isCorrect = num === roundData.correctAnswer;
            btn.style.background = isCorrect ? '#44ff44' : '#ff4444';

            // Disable all buttons
            document.querySelectorAll('.number-btn').forEach(b => b.disabled = true);

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(isCorrect ? [50] : [50, 50, 50]);
            }

            sendResponse(num.toString());
        });
        numberGrid.appendChild(btn);
    });
}

// ============== ROUND 7: GYRO BALANCE ==============
function setupGyroBalance(roundData) {
    if (!gyroBalanceArea) return;

    gyroBalanceArea.classList.remove('hidden');
    balanceScore = 0;

    if (balanceScoreDisplay) {
        balanceScoreDisplay.textContent = '0 điểm';
    }

    // Request device orientation permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }

    // Check balance every 100ms
    balanceInterval = setInterval(() => {
        if (currentRoundType !== 'GYRO_BALANCE') {
            clearInterval(balanceInterval);
            return;
        }

        // Send balance update to server
        const indicator = document.getElementById('balanceIndicator');
        const isBalanced = indicator && indicator.classList.contains('balanced');

        if (isBalanced) {
            balanceScore += 10;
            if (balanceScoreDisplay) {
                balanceScoreDisplay.textContent = `${balanceScore} điểm`;
            }
        }

        socket.emit('balanceUpdate', {
            roomCode,
            balanceScore,
            isBalanced
        });
    }, 100);
}

function handleOrientation(event) {
    if (currentRoundType !== 'GYRO_BALANCE') return;

    const beta = event.beta || 0;  // Front-to-back tilt (-180 to 180)
    const gamma = event.gamma || 0; // Left-to-right tilt (-90 to 90)

    const tolerance = 5; // degrees
    const isBalanced = Math.abs(beta) <= tolerance && Math.abs(gamma) <= tolerance;

    // Move indicator based on tilt
    if (balanceIndicator) {
        // Map gamma (-90 to 90) to x position (-40% to 40%)
        const xOffset = (gamma / 90) * 40;
        // Map beta (will use 0-30 range) to y position
        const yOffset = (beta / 30) * 40;

        balanceIndicator.style.transform = `translate(calc(-50% + ${xOffset}%), calc(-50% + ${yOffset}%))`;

        if (isBalanced) {
            balanceIndicator.classList.add('balanced');
            balanceIndicator.style.color = '#44ff44';
        } else {
            balanceIndicator.classList.remove('balanced');
            balanceIndicator.style.color = '#ff4444';
        }
    }
}

// ============== ROUND 8: ICON HUNT ==============
function setupIconHunt(roundData) {
    if (!iconHuntArea || !iconGrid) return;

    iconHuntArea.classList.remove('hidden');

    // Set target icon display
    if (targetIconDisplay) {
        targetIconDisplay.textContent = roundData.targetIcon;
    }

    // Clear and create icon grid
    iconGrid.innerHTML = '';

    let hasResponded = false;

    roundData.gridIcons.forEach((icon, index) => {
        const iconBtn = document.createElement('button');
        iconBtn.className = 'icon-btn';
        iconBtn.textContent = icon;
        iconBtn.dataset.index = index;

        iconBtn.addEventListener('click', () => {
            if (hasResponded || currentRoundType !== 'ICON_HUNT') return;

            const isCorrect = index === roundData.targetPosition;

            // Visual feedback
            if (isCorrect) {
                hasResponded = true;
                iconBtn.style.background = '#44ff44';
                iconBtn.style.transform = 'scale(1.2)';

                if (navigator.vibrate) {
                    navigator.vibrate([50]);
                }
            } else {
                iconBtn.style.background = '#ff4444';
                iconBtn.disabled = true;

                // Show freeze overlay
                if (freezeOverlay) {
                    freezeOverlay.classList.remove('hidden');
                    setTimeout(() => {
                        freezeOverlay.classList.add('hidden');
                    }, roundData.freezeDuration);
                }

                if (navigator.vibrate) {
                    navigator.vibrate([50, 50, 50]);
                }
            }

            sendResponse(index.toString());
        });

        iconGrid.appendChild(iconBtn);
    });
}

// ============== ROUND 9: SOUND CHECK ==============
function setupSoundCheck(roundData) {
    if (!soundCheckArea || !soundOptions) return;

    soundCheckArea.classList.remove('hidden');

    // Set audio source
    if (soundAudio) {
        soundAudio.src = roundData.correctSound.audio;
    }

    // Play sound button
    if (playSoundBtn) {
        playSoundBtn.onclick = () => {
            if (soundAudio) {
                soundAudio.play();
                playSoundBtn.textContent = '🔊 ĐANG PHÁT...';
                soundAudio.onended = () => {
                    playSoundBtn.textContent = '🔊 PHÁT LẠI';
                };
            }
        };
        // Auto-play once at start
        setTimeout(() => {
            if (soundAudio) soundAudio.play();
            playSoundBtn.textContent = '🔊 PHÁT LẠI';
        }, 500);
    }

    // Clear and create sound options
    soundOptions.innerHTML = '';
    let hasResponded = false;

    roundData.allSounds.forEach(sound => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'sound-option-btn';
        optionBtn.innerHTML = `
            <img src="${sound.image}" alt="${sound.name}" />
            <span>${sound.name}</span>
        `;

        optionBtn.addEventListener('click', () => {
            if (hasResponded || currentRoundType !== 'SOUND_CHECK') return;
            hasResponded = true;

            const isCorrect = sound.id === roundData.correctSoundId;

            // Visual feedback
            optionBtn.style.borderColor = isCorrect ? '#44ff44' : '#ff4444';
            optionBtn.style.transform = 'scale(1.05)';

            // Stop audio on answer
            if (soundAudio) soundAudio.pause();

            if (navigator.vibrate) {
                navigator.vibrate(isCorrect ? [50] : [50, 50, 50]);
            }

            sendResponse(sound.id);
        });

        soundOptions.appendChild(optionBtn);
    });
}

// ============== ROUND 10: FINAL BLITZ ==============
function setupFinalBlitz(roundData) {
    if (!finalBlitzArea || !blitzChallengeContainer) return;

    finalBlitzArea.classList.remove('hidden');
    blitzChallenges = roundData.challenges;
    blitzCurrentChallenge = 0;

    // Show first challenge
    showBlitzChallenge();

    // Auto-advance challenges
    blitzTimer = setInterval(() => {
        blitzCurrentChallenge++;
        if (blitzCurrentChallenge >= blitzChallenges.length) {
            clearInterval(blitzTimer);
            return;
        }
        showBlitzChallenge();
    }, roundData.challengeDuration);
}

function showBlitzChallenge() {
    if (!blitzChallengeContainer) return;

    const challenge = blitzChallenges[blitzCurrentChallenge];
    if (!challenge) return;

    // Update progress
    if (blitzChallengeCount) {
        blitzChallengeCount.textContent = `${blitzCurrentChallenge + 1}/${blitzChallenges.length}`;
    }

    // Clear container
    blitzChallengeContainer.innerHTML = '';

    if (challenge.type === 'COLOR') {
        // Show color buttons
        const colorGrid = document.createElement('div');
        colorGrid.className = 'blitz-color-grid';

        ['RED', 'BLUE', 'YELLOW', 'PURPLE'].forEach(color => {
            const btn = document.createElement('button');
            btn.className = `blitz-color-btn blitz-${color.toLowerCase()}`;
            btn.textContent = color === 'RED' ? 'ĐỎ' : color === 'BLUE' ? 'XANH' : color === 'YELLOW' ? 'VÀNG' : 'TÍM';
            btn.addEventListener('click', () => {
                sendBlitzResponse(color);
                btn.style.transform = 'scale(0.9)';
            });
            colorGrid.appendChild(btn);
        });

        const instruction = document.createElement('h3');
        instruction.textContent = `CHẠM: ${challenge.color === 'RED' ? 'ĐỎ' : challenge.color === 'BLUE' ? 'XANH' : challenge.color === 'YELLOW' ? 'VÀNG' : 'TÍM'}`;
        blitzChallengeContainer.appendChild(instruction);
        blitzChallengeContainer.appendChild(colorGrid);

    } else if (challenge.type === 'SWIPE') {
        const arrows = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' };
        const instruction = document.createElement('h3');
        instruction.textContent = `VUỐT ${arrows[challenge.direction]}`;
        instruction.style.fontSize = '4rem';
        blitzChallengeContainer.appendChild(instruction);

        // Setup quick swipe detection
        let startX, startY;
        blitzChallengeContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        blitzChallengeContainer.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const dx = endX - startX;
            const dy = endY - startY;

            let direction = '';
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'RIGHT' : 'LEFT';
            } else {
                direction = dy > 0 ? 'DOWN' : 'UP';
            }
            sendBlitzResponse(direction);
        });

    } else if (challenge.type === 'TAP') {
        const tapBtn = document.createElement('button');
        tapBtn.className = 'blitz-tap-btn';
        tapBtn.textContent = 'CHẠM!';
        tapBtn.addEventListener('click', () => {
            sendBlitzResponse('TAP');
            tapBtn.style.transform = 'scale(0.9)';
        });
        blitzChallengeContainer.appendChild(tapBtn);

    } else if (challenge.type === 'MATH') {
        const instruction = document.createElement('h3');
        instruction.textContent = challenge.task === 'MIN' ? 'SỐ NHỎ NHẤT' : 'SỐ LỚN NHẤT';

        const numGrid = document.createElement('div');
        numGrid.className = 'blitz-number-grid';

        challenge.numbers.forEach(num => {
            const btn = document.createElement('button');
            btn.className = 'blitz-number-btn';
            btn.textContent = num;
            btn.addEventListener('click', () => {
                sendBlitzResponse(num.toString());
                btn.style.transform = 'scale(0.9)';
            });
            numGrid.appendChild(btn);
        });

        blitzChallengeContainer.appendChild(instruction);
        blitzChallengeContainer.appendChild(numGrid);
    }
}

function sendBlitzResponse(answer) {
    const response = JSON.stringify({
        challengeIndex: blitzCurrentChallenge,
        answer: answer
    });
    sendResponse(response);
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

    // Clear balance interval
    if (balanceInterval) {
        clearInterval(balanceInterval);
        balanceInterval = null;
    }

    // Clear blitz timer
    if (blitzTimer) {
        clearInterval(blitzTimer);
        blitzTimer = null;
    }

    window.removeEventListener('devicemotion', handleShake);
    window.removeEventListener('deviceorientation', handleOrientation);

    // Hide all game areas temporarily
    colorButtons.classList.add('hidden');
    swipeArea.classList.add('hidden');
    shakeArea.classList.add('hidden');
    tapSpamArea.classList.add('hidden');
    if (dontTapArea) dontTapArea.classList.add('hidden');
    if (quickMathArea) quickMathArea.classList.add('hidden');
    if (gyroBalanceArea) gyroBalanceArea.classList.add('hidden');
    if (iconHuntArea) iconHuntArea.classList.add('hidden');
    if (soundCheckArea) soundCheckArea.classList.add('hidden');
    if (finalBlitzArea) finalBlitzArea.classList.add('hidden');

    // Stop any playing audio
    if (soundAudio) {
        soundAudio.pause();
        soundAudio.currentTime = 0;
    }
});

// Game over
socket.on('gameOver', ({ finalLeaderboard }) => {
    const playerRank = finalLeaderboard.findIndex(p => p.id === playerId) + 1;
    const totalPlayers = finalLeaderboard.length;

    // Create game over UI using DOM (not innerHTML for better performance)
    const container = document.createElement('div');
    container.className = 'container';

    const title = document.createElement('h1');
    title.className = 'game-title text-gradient';
    title.textContent = '🎉 HOÀN THÀNH! 🎉';

    const glass = document.createElement('div');
    glass.className = 'glass';
    glass.style.cssText = 'padding: 2rem; border-radius: 1rem; text-align: center;';

    const rankDisplay = document.createElement('h2');
    rankDisplay.style.cssText = 'font-size: 3rem; color: var(--color-yellow); margin-bottom: 1rem;';
    rankDisplay.textContent = `#${playerRank} / ${totalPlayers}`;

    const scoreDisplay = document.createElement('p');
    scoreDisplay.style.cssText = 'font-size: 1.5rem; color: var(--text-secondary);';
    scoreDisplay.innerHTML = `Tổng điểm: <strong style="color: var(--color-yellow);">${currentScore}</strong>`;

    const playAgainBtn = document.createElement('button');
    playAgainBtn.className = 'btn btn-primary btn-lg';
    playAgainBtn.textContent = '🎮 CHƠI LẠI';
    playAgainBtn.style.marginTop = '2rem';
    playAgainBtn.onclick = () => {
        cleanupSocket();
        // Clear URL to prevent auto-rejoin
        window.history.replaceState({}, document.title, '/player.html');
        window.location.href = '/player.html';
    };

    glass.appendChild(rankDisplay);
    glass.appendChild(scoreDisplay);
    glass.appendChild(playAgainBtn);
    container.appendChild(title);
    container.appendChild(glass);

    gameScreen.innerHTML = '';
    gameScreen.appendChild(container);
});

// Room reset - return to waiting screen (game restarting)
socket.on('roomReset', ({ players }) => {
    console.log('[Player] Room reset by host, returning to waiting screen');

    // Reset game state
    currentScore = 0;
    currentRoundType = null;
    shakeCount = 0;
    tapCount = 0;

    // Clear intervals
    if (shakeInterval) {
        clearInterval(shakeInterval);
        shakeInterval = null;
    }
    window.removeEventListener('devicemotion', handleShake);

    // Reset UI
    scoreValue.textContent = '0';
    colorButtons.classList.add('hidden');
    swipeArea.classList.add('hidden');
    shakeArea.classList.add('hidden');
    tapSpamArea.classList.add('hidden');

    // Show waiting screen
    gameScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
});

// Host disconnected - player stays on screen, uses 'Chơi Lại' button when ready
socket.on('hostDisconnected', () => {
    console.log('Host disconnected - player stays on results screen');
    // Do nothing - player is independent
    // They will click 'Chơi Lại' when ready
});

// Cleanup function - called before leaving page
function cleanupSocket() {
    if (socket) {
        socket.removeAllListeners();
    }
    document.body.classList.remove('in-game');
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupSocket);
