// Campus Conquest Socket Handlers
// Add these handlers inside io.on('connection', (socket) => { ... })

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
    console.log(`Conquest room created: ${roomCode}`);
});

socket.on('joinConquestRoom', ({ roomCode, nickname }) => {
    const room = rooms.get(roomCode);

    if (!room || room.gameMode !== 'CONQUEST') {
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
        territory: 0
    };

    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.emit('conquestJoined', { roomCode, playerId: socket.id });

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
});

socket.on('conquestNextRound', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;

    startConquestRound(roomCode);
});
