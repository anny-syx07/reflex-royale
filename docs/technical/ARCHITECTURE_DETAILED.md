# Detailed System Architecture

Reflex Royale is built with a layered architecture designed for real-time multiplayer interaction and loose coupling between components.

## 🏗️ Architectural Layers

### 1. Configuration & Platform Layer
- **Environment Management**: Uses `dotenv` for managing secrets like Firebase credentials and database URLs.
- **Platform Configs**: Dedicated configurations for **Render** (`render.yaml`) and **Railway** (`railway.toml`).
- **Build System**: A custom `build.js` script handles minification and obfuscation for production deployments.

### 2. Server Layer (Backend Core)
The backend is a Node.js application using Express and Socket.IO.
- **Entry Point**: `server.js` handles the HTTP server, Socket.IO initialization, and core game loop logic.
- **Security Middlewares**: Integrated security using Helmet (CSP), express-rate-limit (DDoS protection), and HPP.
- **Event System**: A custom `EventBus` implementation enables a decoupled architecture where the main game loop doesn't need to know about the specifics of analytics or leaderboard broadcasting.

### 3. Handler Layer (Decoupled Logic)
- **Analytics Handler**: Listens for game events via `EventBus` and updates Firebase/Supabase in the background.
- **Leaderboard Handler**: Manages throttled broadcasting of scores to ensure performance isn't degraded during high-frequency tap/shake rounds.

### 4. Client Layer (Frontend)
- **Legacy Frontend**: Located in `public/`, uses Vanilla JS, CSS3, and Socket.IO-client. Organized into specialized files like `host.js`, `player.js`, and conquest-specific scripts.
- **Next-app**: A newer React-based frontend transition located in `next-app/`.

---

## 🛰️ Real-time Communication Flow

The system uses Socket.IO for bidirectional communication:

1. **Room Lifecycle**:
   - **Host** emits `createRoom` -> Server generates 4-digit code -> Server joins Host to room room.
   - **Player** emits `joinRoom` with code -> Server validates room exists -> Server joins Player to room.

2. **Game Loop**:
   - **Host** emits `startGame`.
   - **Server** cycles through rounds, emitting `roundStart` with specific data.
   - **Players** emit responses (`playerResponse`, `shakeUpdate`, etc.).
   - **Server** calculates scores and emits `SCORE_UPDATED` to `EventBus`.
   - **Leaderboard Handler** catches event and emits `leaderboardUpdate` to all clients in the room.

## 🧩 Event-Driven Design (`EventBus.js`)

The `EventBus` is a lightweight singleton implementation of the Observer pattern. It allows `server.js` to remain focused on the game state while other systems react to changes:

```javascript
// Example Flow
// server.js
eventBus.emit('PLAYER_JOINED', { playerId, nickname, roomCode });

// analyticsHandler.js
eventBus.on('PLAYER_JOINED', async (data) => {
    await trackPlayer(data.playerId, data.nickname);
});
```
