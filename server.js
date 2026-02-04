const express = require('express');
const app = express();
const http = require('http').createServer(app);
const path = require('path');

// ============================================================================
// 🛡️ SECURITY PACKAGES
// ============================================================================
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const hpp = require('hpp');

// ============================================================================
// 🛡️ SECURITY CONFIGURATION
// ============================================================================

// Allowed origins for CORS
const allowedOrigins = [
  'https://reflex-royale.onrender.com',
  'https://reflex-royale-production.up.railway.app',
  'http://localhost:3000',
  'http://localhost:10000'
];

// Socket.IO with security options
const io = require('socket.io')(http, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB max message size
  allowEIO3: false // Disable legacy protocol
});

// ============================================================================
// 🛡️ SECURITY MIDDLEWARE
// ============================================================================

// Helmet - HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://www.youtube.com", "https://s.ytimg.com"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "wss:", "ws:", ...allowedOrigins],
      imgSrc: ["'self'", "data:", "blob:", "https://api.dicebear.com"],
      frameSrc: ["'self'", "https://drive.google.com", "https://www.youtube.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// HPP - HTTP Parameter Pollution protection
app.use(hpp());

// General Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: { error: 'Quá nhiều request, thử lại sau 15 phút!' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    return !isProduction && isLocalhost;
  }
});

// Strict Rate Limiting for authentication
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: { error: 'Quá nhiều lần thử, đợi 1 phút!' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    return !isProduction && isLocalhost;
  }
});

// Apply general rate limiting
app.use(generalLimiter);

// ============================================================================
// 🛡️ SECURITY HELPER FUNCTIONS
// ============================================================================

// Sanitize nickname - prevent XSS
function sanitizeNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') return 'Player';

  let clean = xss(nickname.trim());
  clean = clean.substring(0, 20); // Max 20 chars
  clean = clean.replace(/[<>\"\'&]/g, ''); // Remove dangerous chars

  return clean || 'Player';
}

// Validate room code - must be 4 digits
function validateRoomCode(code) {
  if (code === null || code === undefined) return null;

  // Convert to string (handle both string and number input)
  const codeStr = String(code).trim();

  if (!/^\d{4}$/.test(codeStr)) return null;
  return codeStr;
}

// Security event logger
function logSecurityEvent(type, details) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    ...details
  };
  console.log(`[🛡️ SECURITY] ${type}:`, JSON.stringify(details));
}

// Socket.IO connection rate limiting
const connectionAttempts = new Map();

io.use((socket, next) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const now = Date.now();

  const attempts = connectionAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(t => now - t < 60000); // Last 60 seconds

  if (recentAttempts.length > 30) {
    logSecurityEvent('CONNECTION_BLOCKED', { ip, attempts: recentAttempts.length });
    return next(new Error('Too many connection attempts'));
  }

  recentAttempts.push(now);
  connectionAttempts.set(ip, recentAttempts);

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    const cutoff = now - 120000;
    connectionAttempts.forEach((times, key) => {
      const filtered = times.filter(t => t > cutoff);
      if (filtered.length === 0) {
        connectionAttempts.delete(key);
      } else {
        connectionAttempts.set(key, filtered);
      }
    });
  }

  next();
});

// ============================================================================
// EVENTBUS & HANDLERS
// ============================================================================
const eventBus = require('./eventBus');
const analyticsHandler = require('./handlers/analyticsHandler');
const leaderboardHandler = require('./handlers/leaderboardHandler');

// ============================================================================
// FIREBASE HELPERS
// ============================================================================

// Firebase helpers (optional - graceful fallback)
let firebaseHelpers = null;
try {
  firebaseHelpers = require('./firebase-helpers');
  console.log('🔥 Firebase helpers loaded');
} catch (error) {
  console.log('⚠️  Firebase helpers not available - tracking disabled');
}

// Supabase helpers
let supabaseHelpers = null;
try {
  supabaseHelpers = require('./supabase-helpers');
  console.log('⚡ Supabase helpers loaded');
} catch (error) {
  console.log('⚠️  Supabase helpers not available. Reason:', error.message);
  // Log specific env check to debug
  if (!process.env.SUPABASE_URL) console.log('   -> Missing SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.log('   -> Missing SUPABASE_SERVICE_ROLE_KEY');
}

// Extract helper functions with fallbacks, combining both Firebase and Supabase
const trackPlayer = async (id, nickname) => {
  if (firebaseHelpers) await firebaseHelpers.trackPlayer(id, nickname);
  if (supabaseHelpers) await supabaseHelpers.trackPlayer(id, nickname);
};

const updatePlayerScore = async (id, score, nickname) => {
  if (firebaseHelpers) await firebaseHelpers.updatePlayerScore(id, score);
  if (supabaseHelpers) await supabaseHelpers.updatePlayerScore(id, score, nickname);
};

const saveGameResult = async (gameId, gameMode, roomCode, players, winner) => {
  if (firebaseHelpers) await firebaseHelpers.saveGameResult(gameId, gameMode, roomCode, players, winner);
  if (supabaseHelpers) await supabaseHelpers.saveGameResult(gameId, gameMode, roomCode, players, winner);
};

const PORT = process.env.PORT || 3000;

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

// Determine static directory based on environment
const isProduction = process.env.NODE_ENV === 'production';
const staticDir = isProduction ? 'dist' : 'public';
console.log(`📂 Serving static files from: ${staticDir}/ (${isProduction ? 'production' : 'development'} mode)`);

// Serve static files
app.use(express.static(staticDir));
app.use(express.json({ limit: '10kb' })); // Limit body size

// Host password (change this to your desired password)
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'WelcometoUMT';

// Root route - serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, staticDir, 'index.html'));
});

// Password verification endpoint - with strict rate limiting
app.post('/verify-host-password', authLimiter, (req, res) => {
  const { password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  if (password === HOST_PASSWORD) {
    logSecurityEvent('AUTH_SUCCESS', { ip });
    res.json({ success: true });
  } else {
    logSecurityEvent('AUTH_FAILED', { ip });
    res.json({ success: false });
  }
});

// ============================================================================
// 📱 MOBILE TESTING API ENDPOINTS
// ============================================================================

// Health check endpoint - for testing if server is reachable
app.get('/api/health', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  res.json({
    status: 'OK',
    message: 'Server is running! 🚀',
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
    environment: isProduction ? 'production' : 'development',
    clientIp: ip
  });
});

// Device info test - returns what server sees from mobile
app.post('/api/test/device-info', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const { deviceInfo } = req.body;

  res.json({
    success: true,
    message: 'Device info received! 📱',
    serverSaw: {
      ip,
      userAgent,
      headers: {
        'accept-language': req.headers['accept-language'],
        'accept-encoding': req.headers['accept-encoding']
      }
    },
    clientSent: deviceInfo || null,
    timestamp: new Date().toISOString()
  });
});

// Network latency test - ping/pong for testing connection speed
app.get('/api/test/ping', (req, res) => {
  const clientTimestamp = req.query.t || Date.now();
  const serverTimestamp = Date.now();

  res.json({
    success: true,
    message: 'Pong! 🏓',
    clientTimestamp: parseInt(clientTimestamp),
    serverTimestamp,
    latency: serverTimestamp - parseInt(clientTimestamp)
  });
});

// Room status check - for testing if room exists
app.get('/api/test/room/:roomCode', (req, res) => {
  const roomCode = validateRoomCode(req.params.roomCode);

  if (!roomCode) {
    return res.json({
      exists: false,
      error: 'Invalid room code format'
    });
  }

  const room = rooms.get(roomCode);

  if (!room) {
    return res.json({
      exists: false,
      message: 'Room not found'
    });
  }

  res.json({
    exists: true,
    roomCode,
    gameMode: room.gameMode || 'REFLEX',
    gameState: room.gameState,
    playerCount: room.players.size,
    currentRound: room.currentRound || 0
  });
});

// Server info - for debugging
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Reflex Royale Server',
    version: '1.0.0',
    environment: isProduction ? 'production' : 'development',
    activeRooms: rooms.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Room storage
const rooms = new Map();

// ============================================================================
// INITIALIZE EVENT HANDLERS
// ============================================================================
analyticsHandler.init({
  trackPlayer,
  updatePlayerScore,
  saveGameResult
});
leaderboardHandler.init(io, rooms);
console.log('🚀 EventBus handlers initialized');

// Generate unique room code (4 digits)
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

// Round types
const ROUND_TYPES = {
  COLOR_TAP: 'COLOR_TAP',
  SWIPE: 'SWIPE',
  SHAKE: 'SHAKE',
  TAP_SPAM: 'TAP_SPAM',
  DONT_TAP: 'DONT_TAP',
  QUICK_MATH: 'QUICK_MATH',
  GYRO_BALANCE: 'GYRO_BALANCE',
  ICON_HUNT: 'ICON_HUNT',
  SOUND_CHECK: 'SOUND_CHECK',
  FINAL_BLITZ: 'FINAL_BLITZ'
};

// Sound pairs for SOUND_CHECK round
const SOUND_PAIRS = [
  { id: 'birdsong', audio: '/assets/audio/birdsong.mp3', image: '/assets/audio/birdsong.jpg', name: 'Tiếng chim' },
  { id: 'car-horn', audio: '/assets/audio/car-horn.mp3', image: '/assets/audio/car-horn.jpg', name: 'Còi xe' },
  { id: 'explosion', audio: '/assets/audio/explosion.mp3', image: '/assets/audio/explosion.jpg', name: 'Tiếng nổ' }
];

const COLORS = ['RED', 'BLUE', 'YELLOW', 'PURPLE'];
const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Check room mode (for unified player entry)
  socket.on('checkRoomMode', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);

    if (!room) {
      callback({ error: 'Phòng không tồn tại!' });
      return;
    }

    callback({
      gameMode: room.gameMode || 'REFLEX',
      roomCode
    });
  });

  // Host creates a room
  socket.on('createRoom', () => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      hostId: socket.id,
      players: new Map(),
      gameState: 'WAITING', // WAITING, PLAYING, FINISHED
      currentRound: 0,
      totalRounds: 10,
      roundType: null,
      roundData: null,
      roundStartTime: null,
      responses: new Map()
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
    console.log(`Room created: ${roomCode}`);
  });

  // Player joins a room
  socket.on('joinRoom', ({ roomCode: rawRoomCode, nickname: rawNickname }) => {
    console.log('[JOIN] Received join request:', { rawRoomCode, rawNickname, socketId: socket.id });

    // 🛡️ SECURITY: Validate and sanitize input
    const roomCode = validateRoomCode(rawRoomCode);
    const nickname = sanitizeNickname(rawNickname);

    console.log('[JOIN] After validation:', { roomCode, nickname });

    if (!roomCode) {
      console.log('[JOIN] Invalid room code:', rawRoomCode);
      socket.emit('error', { message: 'Mã phòng không hợp lệ!' });
      return;
    }

    // CLEANUP: Leave all previous rooms before joining new one
    const currentRooms = Array.from(socket.rooms);
    currentRooms.forEach(room => {
      if (room !== socket.id) { // Keep socket's own room
        socket.leave(room);
        console.log(`[Cleanup] Socket ${socket.id} left old room ${room}`);
      }
    });

    const room = rooms.get(roomCode);
    console.log('[JOIN] Room exists:', !!room, 'Room code:', roomCode);

    if (!room) {
      console.log('[JOIN] Room not found:', roomCode, 'Available rooms:', Array.from(rooms.keys()));
      socket.emit('error', { message: 'Phòng không tồn tại!' });
      return;
    }

    if (room.gameState !== 'WAITING') {
      console.log('[JOIN] Game already started:', room.gameState);
      socket.emit('error', { message: 'Trò chơi đã bắt đầu!' });
      return;
    }

    // UNIQUE NICKNAME CHECK
    const existingNickname = Array.from(room.players.values()).find(p => p.nickname === nickname);
    if (existingNickname) {
      console.log('[JOIN] Duplicate nickname:', nickname);
      socket.emit('error', { message: `Tên "${nickname}" đã được sử dụng! Vui lòng chọn tên khác.` });
      return;
    }

    const player = {
      id: socket.id,
      nickname: nickname, // Already sanitized above
      score: 0
    };

    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.emit('joinedRoom', { roomCode, playerId: socket.id });

    console.log('[JOIN] Player joined successfully:', { roomCode, nickname, socketId: socket.id });

    // Emit event for handlers (analytics, etc.)
    eventBus.emit('PLAYER_JOINED', { playerId: socket.id, nickname: player.nickname, roomCode });

    // Notify host and all players about updated player list
    const playerList = Array.from(room.players.values());
    io.to(roomCode).emit('playerListUpdate', { players: playerList });

    console.log(`${player.nickname} joined room ${roomCode}`);
  });

  // Host starts the game
  socket.on('startGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room || room.hostId !== socket.id) {
      socket.emit('error', { message: 'Không có quyền!' });
      return;
    }

    room.gameState = 'PLAYING';
    room.currentRound = 0;

    // Reset all player scores
    room.players.forEach(player => player.score = 0);

    io.to(roomCode).emit('gameStarted');
    console.log(`Game started in room ${roomCode}`);

    // Start first round after a short delay
    setTimeout(() => startNextRound(roomCode), 2000);
  });

  // Player response
  socket.on('playerResponse', ({ roomCode, response, timestamp }) => {
    const room = rooms.get(roomCode);

    if (!room || room.gameState !== 'PLAYING') {
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) return;

    // Calculate response time
    const responseTime = timestamp - room.roundStartTime;

    // Store response
    room.responses.set(socket.id, {
      playerId: socket.id,
      response,
      responseTime,
      timestamp
    });

    // Calculate score based on round type
    let points = 0;
    let correct = false;

    if (room.roundType === ROUND_TYPES.COLOR_TAP) {
      correct = response === room.roundData.color;
      if (correct) {
        points = Math.max(100, 1000 - Math.floor(responseTime * 2));
      } else {
        points = -200;
      }
    } else if (room.roundType === ROUND_TYPES.SWIPE) {
      correct = response === room.roundData.direction;
      if (correct) {
        points = Math.max(100, 1000 - Math.floor(responseTime * 2));
      } else {
        points = -200;
      }
    } else if (room.roundType === ROUND_TYPES.DONT_TAP) {
      // In DONT_TAP: response 'TAPPED' means they tapped, 'HELD' means they didn't tap
      const tapped = response === 'TAPPED';
      if (room.roundData.isBomb) {
        // It's a bomb - should NOT tap
        if (tapped) {
          correct = false;
          points = -500; // Heavy penalty for tapping bomb
        } else {
          correct = true;
          points = 200; // Reward for holding
        }
      } else {
        // It's a TAP command - should tap
        if (tapped) {
          correct = true;
          points = Math.max(100, 1000 - Math.floor(responseTime * 2));
        } else {
          correct = false;
          points = 0; // No penalty for not tapping when should tap
        }
      }
    } else if (room.roundType === ROUND_TYPES.QUICK_MATH) {
      // response is the number they selected
      correct = parseInt(response) === room.roundData.correctAnswer;
      if (correct) {
        // Points based on speed
        points = Math.max(100, 1000 - Math.floor(responseTime / 5));
      } else {
        points = 0; // Wrong answer, no points
      }
    } else if (room.roundType === ROUND_TYPES.ICON_HUNT) {
      // response is the index clicked
      const clickedIndex = parseInt(response);
      correct = clickedIndex === room.roundData.targetPosition;
      if (correct) {
        // Fast response = combo bonus
        if (responseTime < 1000) {
          points = 1500; // Combo bonus for < 1 second
        } else if (responseTime < 2000) {
          points = 1000;
        } else {
          points = Math.max(100, 800 - Math.floor(responseTime / 10));
        }
      } else {
        points = -100; // Small penalty for wrong icon
      }
    } else if (room.roundType === ROUND_TYPES.FINAL_BLITZ) {
      // Parse response: { challengeIndex, answer }
      const blitzResponse = typeof response === 'string' ? JSON.parse(response) : response;
      const challengeIdx = blitzResponse.challengeIndex;
      const answer = blitzResponse.answer;
      const challenge = room.roundData.challenges[challengeIdx];

      if (challenge) {
        if (challenge.type === 'COLOR') {
          correct = answer === challenge.color;
        } else if (challenge.type === 'SWIPE') {
          correct = answer === challenge.direction;
        } else if (challenge.type === 'TAP') {
          correct = answer === 'TAP';
        } else if (challenge.type === 'MATH') {
          correct = parseInt(answer) === challenge.answer;
        }

        if (correct) {
          // 2x multiplier for final blitz
          points = Math.max(50, 200 - Math.floor(responseTime / 20)) * room.roundData.pointMultiplier;
        } else {
          points = 0;
        }
      }
    } else if (room.roundType === ROUND_TYPES.SOUND_CHECK) {
      // response is the sound id they selected
      correct = response === room.roundData.correctSoundId;
      if (correct) {
        // Points based on speed - faster = more points
        if (responseTime < 1500) {
          points = 1500; // Very fast bonus
        } else if (responseTime < 3000) {
          points = 1000;
        } else {
          points = Math.max(100, 800 - Math.floor(responseTime / 10));
        }
      } else {
        points = 0; // Wrong sound, no points
      }
    }

    player.score += points;

    // Send feedback to player
    socket.emit('responseResult', { correct, points, totalScore: player.score });

    // Emit event for leaderboard handler (throttled there)
    eventBus.emit('SCORE_UPDATED', { roomCode, playerId: socket.id, score: player.score });
  });

  // Shake count update
  socket.on('shakeUpdate', ({ roomCode, shakeCount }) => {
    const room = rooms.get(roomCode);

    if (!room || room.gameState !== 'PLAYING' || room.roundType !== ROUND_TYPES.SHAKE) {
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) return;

    // Store shake count
    room.responses.set(socket.id, {
      playerId: socket.id,
      shakeCount,
      timestamp: Date.now()
    });

    // OPTIMIZATION: Throttle energy bar updates (max 10 per second)
    if (!room.lastEnergyUpdate || Date.now() - room.lastEnergyUpdate > 100) {
      room.lastEnergyUpdate = Date.now();

      // Calculate total shakes for energy bar
      let totalShakes = 0;
      room.responses.forEach(response => {
        totalShakes += response.shakeCount || 0;
      });

      // Broadcast energy bar update
      io.to(roomCode).emit('energyBarUpdate', { totalShakes, maxShakes: room.players.size * 100 });
    }
  });

  // Tap spam update
  socket.on('tapUpdate', ({ roomCode, tapCount }) => {
    const room = rooms.get(roomCode);

    if (!room || room.gameState !== 'PLAYING' || room.roundType !== ROUND_TYPES.TAP_SPAM) {
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) return;

    // Store tap count
    room.responses.set(socket.id, {
      playerId: socket.id,
      tapCount,
      timestamp: Date.now()
    });
  });

  // Gyroscope balance update
  socket.on('balanceUpdate', ({ roomCode, balanceScore, isBalanced }) => {
    const room = rooms.get(roomCode);

    if (!room || room.gameState !== 'PLAYING' || room.roundType !== ROUND_TYPES.GYRO_BALANCE) {
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) return;

    // Accumulate balance score
    const existing = room.responses.get(socket.id) || { balanceScore: 0, balancedTicks: 0 };
    room.responses.set(socket.id, {
      playerId: socket.id,
      balanceScore: existing.balanceScore + (isBalanced ? 10 : 0),
      balancedTicks: existing.balancedTicks + (isBalanced ? 1 : 0),
      timestamp: Date.now()
    });
  });

  // Host requests next round
  socket.on('nextRound', ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room || room.hostId !== socket.id) {
      return;
    }

    startNextRound(roomCode);
  });

  // === CAMPUS CONQUEST HANDLERS ===
  socket.on('createConquestRoom', () => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      hostId: socket.id,
      gameMode: 'CONQUEST',
      players: new Map(),
      gameState: 'WAITING',
      currentRound: 0,
      maxRounds: 12,
      grid: Array(10).fill(null).map(() => Array(10).fill(null)),
      specialCells: generateSpecialCells(),
      playerActions: new Map(),
      roundTimer: null
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('conquestRoomCreated', { roomCode });
  });

  socket.on('joinConquestRoom', ({ roomCode: rawRoomCode, nickname: rawNickname }) => {
    // 🛡️ SECURITY: Validate and sanitize input
    const roomCode = validateRoomCode(rawRoomCode);
    const nickname = sanitizeNickname(rawNickname);

    if (!roomCode) {
      socket.emit('error', { message: 'Mã phòng không hợp lệ!' });
      return;
    }
    // CLEANUP: Leave all previous rooms before joining new one
    const currentRooms = Array.from(socket.rooms);
    currentRooms.forEach(room => {
      if (room !== socket.id) { // Keep socket's own room
        socket.leave(room);
        console.log(`[Cleanup] Socket ${socket.id} left old room ${room}`);
      }
    });

    const room = rooms.get(roomCode);
    if (!room || room.gameMode !== 'CONQUEST') {
      socket.emit('error', { message: 'Phòng không tồn tại!' });
      return;
    }
    if (room.gameState !== 'WAITING') {
      socket.emit('error', { message: 'Trò chơi đã bắt đầu!' });
      return;
    }

    // UNIQUE NICKNAME CHECK
    const existingPlayer = Array.from(room.players.values()).find(p => p.nickname === nickname);
    if (existingPlayer) {
      socket.emit('error', { message: `Tên "${nickname}" đã được sử dụng! Vui lòng chọn tên khác.` });
      return;
    }

    const player = {
      id: socket.id,
      nickname: nickname, // Already sanitized above
      territory: 0
    };
    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.emit('conquestJoined', { roomCode, playerId: socket.id });

    // Track player in Firebase
    trackPlayer(socket.id, player.nickname);

    const playerList = Array.from(room.players.values());
    io.to(roomCode).emit('conquestPlayerListUpdate', { players: playerList });
  });

  socket.on('startConquestGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id || room.gameMode !== 'CONQUEST') return;
    room.gameState = 'PLAYING';
    room.currentRound = 0;
    io.to(roomCode).emit('conquestGameStarted');
    setTimeout(() => startConquestRound(roomCode), 2000);
  });

  socket.on('conquestSubmitActions', ({ roomCode, actions }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'PLAYING') return;
    room.playerActions.set(socket.id, actions);
    console.log(`[Conquest] Player ${socket.id} submitted ${actions.length} actions for room ${roomCode}`);
  });

  // Real-time cell selection for host visibility
  socket.on('conquestCellClicked', ({ roomCode, x, y, action }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'PLAYING') return;

    // Broadcast to host only
    io.to(room.hostId).emit('conquestPlayerCellUpdate', {
      playerId: socket.id,
      playerNickname: room.players.get(socket.id)?.nickname || 'Player',
      x,
      y,
      action // 'add' or 'remove'
    });
  });

  socket.on('conquestNextRound', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    startConquestRound(roomCode);
  });

  // === SOFT RESET HANDLERS ===

  // Reset Reflex Royale room (keep players, reset game state)
  socket.on('resetRoom', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) {
      socket.emit('error', { message: 'Không có quyền!' });
      return;
    }

    // Reset game state
    room.gameState = 'WAITING';
    room.currentRound = 0;
    room.roundType = null;
    room.roundData = null;
    room.roundStartTime = null;
    room.responses.clear();

    // Reset all player scores
    room.players.forEach(player => {
      player.score = 0;
    });

    // Notify all players
    const playerList = Array.from(room.players.values());
    io.to(roomCode).emit('roomReset', { players: playerList });
    io.to(roomCode).emit('playerListUpdate', { players: playerList });

    console.log(`[Reset] Room ${roomCode} reset by host. ${playerList.length} players kept.`);
  });

  // Reset Campus Conquest room (keep players, reset game state)
  socket.on('resetConquestRoom', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id || room.gameMode !== 'CONQUEST') {
      socket.emit('error', { message: 'Không có quyền!' });
      return;
    }

    // Clear timer if running
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    // Reset game state
    room.gameState = 'WAITING';
    room.currentRound = 0;
    room.grid = Array(10).fill(null).map(() => Array(10).fill(null));
    room.specialCells = generateSpecialCells();
    room.playerActions.clear();

    // Reset all player territories
    room.players.forEach(player => {
      player.territory = 0;
    });

    // Notify all players
    const playerList = Array.from(room.players.values());
    io.to(roomCode).emit('conquestRoomReset', { players: playerList });
    io.to(roomCode).emit('conquestPlayerListUpdate', { players: playerList });

    console.log(`[Reset] Conquest room ${roomCode} reset by host. ${playerList.length} players kept.`);
  });

  // === HOST RECONNECTION ===

  // Host reconnects to existing room
  socket.on('reconnectHost', ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('reconnectResult', { success: false, message: 'Phòng không tồn tại hoặc đã hết hạn!' });
      return;
    }

    // Check if room is waiting for host reconnection
    if (room.hostDisconnectTimeout) {
      clearTimeout(room.hostDisconnectTimeout);
      room.hostDisconnectTimeout = null;
    }

    // Update host ID to new socket
    const oldHostId = room.hostId;
    room.hostId = socket.id;
    socket.join(roomCode);

    // Notify players that host is back
    io.to(roomCode).emit('hostReconnected');

    // Send current state to host
    const playerList = Array.from(room.players.values());
    socket.emit('reconnectResult', {
      success: true,
      roomCode,
      gameState: room.gameState,
      players: playerList,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds || room.maxRounds,
      gameMode: room.gameMode || 'REFLEX'
    });

    console.log(`[Reconnect] Host reconnected to room ${roomCode}. Old: ${oldHostId}, New: ${socket.id}`);
  });

  // Disconnect handling with grace period
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove player from any room they were in
    rooms.forEach((room, roomCode) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        const playerList = Array.from(room.players.values());
        io.to(roomCode).emit('playerListUpdate', { players: playerList });

        // Also emit conquest-specific event if needed
        if (room.gameMode === 'CONQUEST') {
          io.to(roomCode).emit('conquestPlayerListUpdate', { players: playerList });
        }
      }

      // If host disconnects, start grace period instead of immediate deletion
      if (room.hostId === socket.id) {
        console.log(`[Grace] Host disconnected from room ${roomCode}. Starting 60s grace period...`);

        // Notify players that host is temporarily disconnected
        io.to(roomCode).emit('hostTemporarilyDisconnected');

        // Set 60-second grace period
        room.hostDisconnectTimeout = setTimeout(() => {
          // Check if room still exists and host hasn't reconnected
          const currentRoom = rooms.get(roomCode);
          if (currentRoom && currentRoom.hostId === socket.id) {
            console.log(`[Grace] Grace period expired for room ${roomCode}. Deleting room.`);
            io.to(roomCode).emit('hostDisconnected');
            rooms.delete(roomCode);
          }
        }, 60000); // 60 seconds grace period
      }
    });
  });
});

// Start next round
function startNextRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.currentRound++;

  if (room.currentRound > room.totalRounds) {
    endGame(roomCode);
    return;
  }

  // Clear previous responses
  room.responses.clear();

  // Vòng 1: COLOR_TAP (Chạm Đúng Màu)
  // Vòng 2: SWIPE (Vuốt Đúng Hướng)
  // Vòng 3: SHAKE (Lắc Điên Cuồng)
  // Vòng 4: TAP_SPAM (Chạm Liên Hoàn)
  // Vòng 5: DONT_TAP (Đừng Chạm!)
  // Vòng 6: QUICK_MATH (Con Số May Mắn)
  // Vòng 7: GYRO_BALANCE (Cân Bằng Tuyệt Đối)
  // Vòng 8: ICON_HUNT (Truy Tìm Biểu Tượng)
  // Vòng 9: SOUND_CHECK (Phản Xạ Âm Thanh)
  // Vòng 10: FINAL_BLITZ (Vòng Về Đích)
  const roundSequence = [
    ROUND_TYPES.COLOR_TAP,
    ROUND_TYPES.SWIPE,
    ROUND_TYPES.SHAKE,
    ROUND_TYPES.TAP_SPAM,
    ROUND_TYPES.DONT_TAP,
    ROUND_TYPES.QUICK_MATH,
    ROUND_TYPES.GYRO_BALANCE,
    ROUND_TYPES.ICON_HUNT,
    ROUND_TYPES.SOUND_CHECK,
    ROUND_TYPES.FINAL_BLITZ
  ];
  const roundIndex = room.currentRound - 1;
  room.roundType = roundSequence[roundIndex];

  // Generate round data
  room.roundStartTime = Date.now();

  switch (room.roundType) {
    case ROUND_TYPES.COLOR_TAP:
      room.roundData = {
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
      break;
    case ROUND_TYPES.SWIPE:
      room.roundData = {
        direction: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
      };
      break;
    case ROUND_TYPES.SHAKE:
      room.roundData = {
        duration: 10000 // 10 seconds
      };
      break;
    case ROUND_TYPES.TAP_SPAM:
      room.roundData = {
        duration: 10000 // 10 seconds
      };
      break;
    case ROUND_TYPES.DONT_TAP:
      // 70% chance of BOMB (don't tap), 30% chance of TAP (tap it)
      const isBomb = Math.random() < 0.7;
      room.roundData = {
        isBomb: isBomb,
        command: isBomb ? 'BOMB' : 'TAP',
        duration: 4000 // 4 seconds to react/hold
      };
      break;
    case ROUND_TYPES.QUICK_MATH:
      // Generate 4 random numbers and randomly pick min or max task
      const numbers = [];
      while (numbers.length < 4) {
        const num = Math.floor(Math.random() * 99) + 1;
        if (!numbers.includes(num)) numbers.push(num);
      }
      const findMin = Math.random() < 0.5;
      const correctAnswer = findMin ? Math.min(...numbers) : Math.max(...numbers);
      room.roundData = {
        numbers: numbers,
        task: findMin ? 'MIN' : 'MAX',
        correctAnswer: correctAnswer,
        duration: 8000 // 8 seconds
      };
      break;
    case ROUND_TYPES.GYRO_BALANCE:
      room.roundData = {
        duration: 10000, // 10 seconds
        tolerance: 5 // degrees tolerance
      };
      break;
    case ROUND_TYPES.ICON_HUNT:
      // Similar emoji pairs - target vs distractors
      const iconPairs = [
        { target: '😂', distractors: ['😊', '😄', '🙂', '😀'] },
        { target: '🍎', distractors: ['🍏', '🍑', '🍓', '🍒'] },
        { target: '⭐', distractors: ['✨', '💫', '🌟', '⚡'] },
        { target: '❤️', distractors: ['💖', '💗', '💕', '💓'] },
        { target: '🔵', distractors: ['🟦', '💙', '🔷', '🫐'] }
      ];
      const selectedPair = iconPairs[Math.floor(Math.random() * iconPairs.length)];

      // Create 4x4 grid (16 icons) with exactly 1 target
      const gridIcons = [];
      const targetPosition = Math.floor(Math.random() * 16);

      for (let i = 0; i < 16; i++) {
        if (i === targetPosition) {
          gridIcons.push(selectedPair.target);
        } else {
          gridIcons.push(selectedPair.distractors[Math.floor(Math.random() * selectedPair.distractors.length)]);
        }
      }

      room.roundData = {
        targetIcon: selectedPair.target,
        gridIcons: gridIcons,
        targetPosition: targetPosition,
        duration: 8000, // 8 seconds
        freezeDuration: 2000 // 2 second freeze on wrong answer
      };
      break;
    case ROUND_TYPES.SOUND_CHECK:
      // Pick a random sound to play
      const correctSound = SOUND_PAIRS[Math.floor(Math.random() * SOUND_PAIRS.length)];

      room.roundData = {
        correctSoundId: correctSound.id,
        correctSound: correctSound,
        allSounds: SOUND_PAIRS, // Send all options to players
        duration: 8000 // 8 seconds
      };
      break;
    case ROUND_TYPES.FINAL_BLITZ:
      // Generate 10 rapid challenges mixing different round types
      const blitzChallenges = [];
      const challengeTypes = ['COLOR', 'SWIPE', 'TAP', 'MATH'];

      for (let i = 0; i < 10; i++) {
        const type = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
        let challenge = { type };

        if (type === 'COLOR') {
          challenge.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        } else if (type === 'SWIPE') {
          challenge.direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        } else if (type === 'TAP') {
          challenge.action = 'TAP';
        } else if (type === 'MATH') {
          const nums = [];
          while (nums.length < 4) {
            const n = Math.floor(Math.random() * 99) + 1;
            if (!nums.includes(n)) nums.push(n);
          }
          const findMin = Math.random() < 0.5;
          challenge.numbers = nums;
          challenge.task = findMin ? 'MIN' : 'MAX';
          challenge.answer = findMin ? Math.min(...nums) : Math.max(...nums);
        }

        blitzChallenges.push(challenge);
      }

      room.roundData = {
        challenges: blitzChallenges,
        currentChallenge: 0,
        duration: 30000, // 30 seconds total
        challengeDuration: 2500, // 2.5 seconds per challenge
        pointMultiplier: 2 // x2 points
      };
      break;
  }

  // Broadcast round start
  io.to(roomCode).emit('roundStart', {
    roundNumber: room.currentRound,
    totalRounds: room.totalRounds,
    roundType: room.roundType,
    roundData: room.roundData,
    startTime: room.roundStartTime
  });

  console.log(`Round ${room.currentRound} started in room ${roomCode}: ${room.roundType} `);

  // Auto-end rounds after duration
  if (room.roundType === ROUND_TYPES.SHAKE || room.roundType === ROUND_TYPES.TAP_SPAM) {
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  } else if (room.roundType === ROUND_TYPES.COLOR_TAP || room.roundType === ROUND_TYPES.SWIPE) {
    // Auto-end COLOR_TAP and SWIPE after 5 seconds
    setTimeout(() => endRound(roomCode), 5000);
  } else if (room.roundType === ROUND_TYPES.DONT_TAP) {
    // Auto-end DONT_TAP after duration
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  } else if (room.roundType === ROUND_TYPES.QUICK_MATH) {
    // Auto-end QUICK_MATH after duration
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  } else if (room.roundType === ROUND_TYPES.GYRO_BALANCE) {
    // Auto-end GYRO_BALANCE after duration
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  } else if (room.roundType === ROUND_TYPES.ICON_HUNT) {
    // Auto-end ICON_HUNT after duration
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  } else if (room.roundType === ROUND_TYPES.SOUND_CHECK) {
    // Auto-end SOUND_CHECK after duration
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  } else if (room.roundType === ROUND_TYPES.FINAL_BLITZ) {
    // Auto-end FINAL_BLITZ after duration
    setTimeout(() => endRound(roomCode), room.roundData.duration);
  }
}

// End current round and calculate scores
function endRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Calculate scores for shake and tap spam rounds
  if (room.roundType === ROUND_TYPES.SHAKE || room.roundType === ROUND_TYPES.TAP_SPAM) {
    const responsesArray = Array.from(room.responses.entries());

    if (room.roundType === ROUND_TYPES.SHAKE) {
      // Sort by shake count
      responsesArray.sort((a, b) => (b[1].shakeCount || 0) - (a[1].shakeCount || 0));

      responsesArray.forEach(([playerId, response], index) => {
        const player = room.players.get(playerId);
        if (!player) return;

        let points = (response.shakeCount || 0) * 10;

        // Bonus for top 3
        if (index === 0) points += 500;
        else if (index === 1) points += 300;
        else if (index === 2) points += 100;

        player.score += points;
      });
    } else if (room.roundType === ROUND_TYPES.TAP_SPAM) {
      // Sort by tap count
      responsesArray.sort((a, b) => (b[1].tapCount || 0) - (a[1].tapCount || 0));

      responsesArray.forEach(([playerId, response], index) => {
        const player = room.players.get(playerId);
        if (!player) return;

        let points = (response.tapCount || 0) * 5;

        // Bonus for top 3
        if (index === 0) points += 500;
        else if (index === 1) points += 300;
        else if (index === 2) points += 100;

        player.score += points;
      });
    }

    // Send final scores to all players
    room.players.forEach((player, playerId) => {
      io.to(playerId).emit('responseResult', {
        points: player.score,
        totalScore: player.score
      });
    });
  }

  // Calculate scores for GYRO_BALANCE
  if (room.roundType === ROUND_TYPES.GYRO_BALANCE) {
    const responsesArray = Array.from(room.responses.entries());
    // Sort by balance score
    responsesArray.sort((a, b) => (b[1].balanceScore || 0) - (a[1].balanceScore || 0));

    responsesArray.forEach(([playerId, response], index) => {
      const player = room.players.get(playerId);
      if (!player) return;

      // Points = accumulated balance score
      let points = response.balanceScore || 0;

      // Bonus for top 3
      if (index === 0) points += 500;
      else if (index === 1) points += 300;
      else if (index === 2) points += 100;

      player.score += points;

      // Send feedback
      io.to(playerId).emit('responseResult', {
        points: points,
        totalScore: player.score
      });
    });
  }

  // Update final leaderboard
  // Emit event for leaderboard update (bypass throttle)
  eventBus.emit('ROUND_ENDED', { roomCode });
  io.to(roomCode).emit('roundEnd');
}

// End game
function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Prevent duplicate calls - check if already finished
  if (room.gameState === 'FINISHED') {
    console.log(`[Warning] endGame called again for already finished room ${roomCode}`);
    return;
  }

  room.gameState = 'FINISHED';

  const finalLeaderboard = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score);

  // Emit event for analytics handler (saves to Firebase)
  const winner = finalLeaderboard[0] || null;
  eventBus.emit('GAME_ENDED', {
    roomCode,
    gameMode: 'REFLEX',
    leaderboard: finalLeaderboard,
    winner
  });

  io.to(roomCode).emit('gameOver', { finalLeaderboard });
  console.log(`Game ended in room ${roomCode}`);
}

// Start conquest round
function startConquestRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.currentRound++;

  if (room.currentRound > room.maxRounds) {
    endConquestGame(roomCode);
    return;
  }

  // DON'T clear playerActions here - they haven't been processed yet!
  // Clearing happens in endConquestRound AFTER processing

  const mapState = {
    grid: room.grid.map(row => [...row]),
    specialCells: room.specialCells
  };

  io.to(roomCode).emit('conquestRoundStart', {
    roundNumber: room.currentRound,
    maxRounds: room.maxRounds,
    currentAP: 3,
    mapState,
    duration: 5000
  });

  console.log(`Conquest round ${room.currentRound} started in room ${roomCode} `);

  // Auto-end round after 14 seconds (12s client duration + 2s buffer for network delay)
  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => endConquestRound(roomCode), 7000);
}

// End conquest round
function endConquestRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Resolve conflicts
  const cellClaims = new Map();

  room.playerActions.forEach((actions, playerId) => {
    actions.forEach(({ x, y }) => {
      const key = `${x},${y} `;
      if (!cellClaims.has(key)) cellClaims.set(key, []);
      cellClaims.get(key).push(playerId);
    });
  });

  const conflicts = [];

  cellClaims.forEach((claimants, key) => {
    const [x, y] = key.split(',').map(Number);

    if (claimants.length === 1) {
      // Single claim = success
      room.grid[x][y] = claimants[0];
    } else {
      // Conflict = nobody gets it
      conflicts.push({ x, y });
    }
  });

  // Calculate territories
  room.players.forEach((player, playerId) => {
    let territory = 0;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        if (room.grid[x][y] === playerId) {
          const multiplier = getCellMultiplier(room.specialCells, x, y);
          territory += multiplier;
        }
      }
    }
    player.territory = territory;
  });

  // Build leaderboard
  const leaderboard = Array.from(room.players.values())
    .sort((a, b) => b.territory - a.territory)
    .map((p, index) => ({ ...p, rank: index + 1 }));

  // Send updates
  const mapState = {
    grid: room.grid.map(row => [...row]),
    specialCells: room.specialCells
  };

  io.to(roomCode).emit('conquestMapUpdate', {
    grid: room.grid,
    leaderboard,
    conflictsThisRound: conflicts
  });

  room.players.forEach((player, playerId) => {
    const playerRank = leaderboard.find(p => p.id === playerId)?.rank || '-';
    io.to(playerId).emit('conquestRoundEnd', {
      mapState,
      conflicts,
      yourTerritory: player.territory,
      yourRank: playerRank
    });
  });

  // Also emit to host so they can show the "Next Round" button
  io.to(room.hostId).emit('conquestRoundEnd', {
    leaderboard,
    conflicts
  });

  console.log(`[Conquest] Round ${room.currentRound} - Total actions: ${room.playerActions.size}, Cells claimed: ${cellClaims.size}, Conflicts: ${conflicts.length} `);

  console.log(`Conquest round ${room.currentRound} ended in room ${roomCode} `);

  // Clear actions AFTER processing them
  room.playerActions.clear();
}

// End conquest game
function endConquestGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Prevent duplicate calls - check if already finished
  if (room.gameState === 'FINISHED') {
    console.log(`[Warning] endConquestGame called again for already finished room ${roomCode}`);
    return;
  }

  room.gameState = 'FINISHED';

  const finalLeaderboard = Array.from(room.players.values())
    .sort((a, b) => b.territory - a.territory)
    .map((p, index) => ({ ...p, rank: index + 1 }));

  // Save game result to Firebase (only once)
  const gameId = `conquest_${roomCode}_${Date.now()}`;
  const winner = finalLeaderboard[0] || null;
  saveGameResult(gameId, 'CONQUEST', roomCode, finalLeaderboard, winner);

  // Update player scores in Firebase (using territory as score)
  finalLeaderboard.forEach(player => {
    updatePlayerScore(player.id, player.territory);
  });

  room.players.forEach((player, playerId) => {
    const playerRank = finalLeaderboard.find(p => p.id === playerId)?.rank || '-';
    io.to(playerId).emit('conquestGameOver', {
      yourRank: playerRank,
      yourTerritory: player.territory
    });
  });

  io.to(room.hostId).emit('conquestGameOver', { finalLeaderboard });

  console.log(`Conquest game ended in room ${roomCode} `);
}

// Helper: Generate special cells
function generateSpecialCells(count = 8) {
  const cells = [];
  const positions = new Set();

  while (cells.length < count) {
    const x = Math.floor(Math.random() * 10);
    const y = Math.floor(Math.random() * 10);
    const key = `${x},${y} `;

    if (!positions.has(key)) {
      positions.add(key);
      cells.push({
        x,
        y,
        multiplier: cells.length < count / 2 ? 2 : 3
      });
    }
  }

  return cells;
}

// Helper: Get cell multiplier
function getCellMultiplier(specialCells, x, y) {
  const special = specialCells.find(cell => cell.x === x && cell.y === y);
  return special ? special.multiplier : 1;
}

// =============================================================================
// END CAMPUS CONQUEST
// =============================================================================


// Start server
http.listen(PORT, () => {
  console.log(`✨ Reflex Royale server running on http://localhost:${PORT}`);
  console.log(`📱 Host: http://localhost:${PORT}/host.html`);
  console.log(`🎮 Player: http://localhost:${PORT}/player.html`);
});
