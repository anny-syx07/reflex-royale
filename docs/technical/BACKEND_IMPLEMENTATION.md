# Backend Implementation Details

The core of Reflex Royale resides in `server.js`, a comprehensive implementation managing multiple game modes, security, and room-based states.

## 🚀 Server Initialization

- **HTTP Server**: Uses Node's `http` module wrapped around an `express` instance.
- **Socket.IO Config**:
  - `pingTimeout`: 60000ms (to handle mobile network fluctuations)
  - `maxHttpBufferSize`: 1MB
  - `cors`: Restricted to a whitelist of deployment and local domains.

## 🛡️ Security Implementation

Security is a first-class citizen in the implementation:

1. **Input Sanitization**:
   - `sanitizeNickname()`: Uses the `xss` package and regex to strip dangerous characters and limit length (20 chars).
   - `validateRoomCode()`: Strict 4-digit numeric validation.
2. **Rate Limiting**:
   - **General Limiter**: 200 requests per 15 minutes.
   - **Auth Limiter**: 5 attempts per minute for host password verification.
   - **Socket Limiter**: Custom middleware tracks connection attempts per IP to block flooding (>30 attempts/min).
3. **Helmet.js**: Configured with a strict Content Security Policy (CSP) including directives for YouTube, Dicebear, and CDNs.

## 🏠 Room Management

Rooms are stored in a `Map()` object for O(1) access. Each room object contains:
- `players`: A sub-Map of socket IDs to player data.
- `gameState`: `WAITING`, `PLAYING`, or `FINISHED`.
- `responses`: A Map tracking player answers for the current round.
- **Host Grace Period**: If a host disconnects, the room isn't immediately deleted. A 60-second `setTimeout` allows for reconnection, notifying players with `hostTemporarilyDisconnected`.

## 🎮 Core Logic Loops

### Reflex Royale Loop
Controlled by `startNextRound()`:
- Selects round type from a sequence.
- Generates challenge data (random colors, math problems, etc.).
- Sets `roundStartTime`.
- Uses `setTimeout` to trigger `endRound()` based on round duration.

### Campus Conquest Loop
- Uses a 10x10 coordinate grid.
- **AP System**: Each player gets 3 Action Points per round.
- **Conflict Resolution**: Logic in `endConquestRound()` checks if multiple players claimed the same cell; if so, the cell remains unowned (neutralized).
- **Special Cells**: Logic for 2x and 3x multipliers is applied during score calculation.

## 📡 Socket Event Summary

| Event | Direction | Description |
|-------|-----------|-------------|
| `createRoom` | Client -> Server | Host initializes a new session |
| `joinRoom` | Client -> Server | Player enters a code to join |
| `startGame` | Client -> Server | Host triggers the transition from lobby to game |
| `playerResponse`| Client -> Server | Raw response data (color, tap, answer) |
| `roundStart` | Server -> Client | Broadcasts challenge data and countdown |
| `leaderboardUpdate`| Server -> Client | Throttled broadcast of current standings |
