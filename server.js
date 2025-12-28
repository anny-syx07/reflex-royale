const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Host password (change this to your desired password)
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'reflex2025';

// Root route - serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Password verification endpoint
app.post('/verify-host-password', (req, res) => {
  const { password } = req.body;

  if (password === HOST_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Room storage
const rooms = new Map();

// Generate unique room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Round types
const ROUND_TYPES = {
  COLOR_TAP: 'COLOR_TAP',
  SWIPE: 'SWIPE',
  SHAKE: 'SHAKE',
  TAP_SPAM: 'TAP_SPAM'
};

const COLORS = ['RED', 'BLUE', 'YELLOW', 'PURPLE'];
const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Host creates a room
  socket.on('createRoom', () => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      hostId: socket.id,
      players: new Map(),
      gameState: 'WAITING', // WAITING, PLAYING, FINISHED
      currentRound: 0,
      totalRounds: 4,
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
  socket.on('joinRoom', ({ roomCode, nickname }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', { message: 'Phòng không tồn tại!' });
      return;
    }

    if (room.gameState !== 'WAITING') {
      socket.emit('error', { message: 'Trò chơi đã bắt đầu!' });
      return;
    }

    const player = {
      id: socket.id,
      nickname: nickname || `Player${room.players.size + 1}`,
      score: 0
    };

    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.emit('joinedRoom', { roomCode, playerId: socket.id });

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
    }

    player.score += points;

    // Send feedback to player
    socket.emit('responseResult', { correct, points, totalScore: player.score });

    // Update leaderboard
    const leaderboard = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    io.to(roomCode).emit('leaderboardUpdate', { leaderboard });
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

    // Calculate total shakes for energy bar
    let totalShakes = 0;
    room.responses.forEach(response => {
      totalShakes += response.shakeCount || 0;
    });

    // Broadcast energy bar update
    io.to(roomCode).emit('energyBarUpdate', { totalShakes, maxShakes: room.players.size * 100 });
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

  // Host requests next round
  socket.on('nextRound', ({ roomCode }) => {
    const room = rooms.get(roomCode);

    if (!room || room.hostId !== socket.id) {
      return;
    }

    startNextRound(roomCode);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove player from any room they were in
    rooms.forEach((room, roomCode) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        const playerList = Array.from(room.players.values());
        io.to(roomCode).emit('playerListUpdate', { players: playerList });
      }

      // If host disconnects, end the game
      if (room.hostId === socket.id) {
        io.to(roomCode).emit('hostDisconnected');
        rooms.delete(roomCode);
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

  // Sequential round type selection
  // Vòng 1: COLOR_TAP (Chạm Đúng Màu)
  // Vòng 2: SWIPE (Vuốt Đúng Hướng)
  // Vòng 3: SHAKE (Lắc Điên Cuồng)
  // Vòng 4: TAP_SPAM (Chạm Liên Hoàn)
  const roundSequence = [
    ROUND_TYPES.COLOR_TAP,
    ROUND_TYPES.SWIPE,
    ROUND_TYPES.SHAKE,
    ROUND_TYPES.TAP_SPAM
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
  }

  // Broadcast round start
  io.to(roomCode).emit('roundStart', {
    roundNumber: room.currentRound,
    totalRounds: room.totalRounds,
    roundType: room.roundType,
    roundData: room.roundData,
    startTime: room.roundStartTime
  });

  console.log(`Round ${room.currentRound} started in room ${roomCode}: ${room.roundType}`);

  // Auto-end shake and tap spam rounds after duration
  if (room.roundType === ROUND_TYPES.SHAKE || room.roundType === ROUND_TYPES.TAP_SPAM) {
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

  // Update final leaderboard
  const leaderboard = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  io.to(roomCode).emit('leaderboardUpdate', { leaderboard });
  io.to(roomCode).emit('roundEnd');
}

// End game
function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState = 'FINISHED';

  const finalLeaderboard = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score);

  io.to(roomCode).emit('gameOver', { finalLeaderboard });
  console.log(`Game ended in room ${roomCode}`);
}

// Start server
http.listen(PORT, () => {
  console.log(`✨ Reflex Royale server running on http://localhost:${PORT}`);
  console.log(`📱 Host: http://localhost:${PORT}/host.html`);
  console.log(`🎮 Player: http://localhost:${PORT}/player.html`);
});
