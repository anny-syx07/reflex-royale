# Reflex Royale - Project Documentation

## 📁 Project Structure (Organized by Layer)

```
reflex-royale/
│
├── 🔧 CONFIGURATION LAYER
│   ├── package.json              # Dependencies & scripts
│   ├── render.yaml               # Render deployment config
│   ├── railway.toml              # Railway deployment config
│   ├── .gitignore                # Git ignore rules
│   └── .platform/                # Platform-specific configs
│       ├── render/
│       └── railway/
│
├── 🖥️ SERVER LAYER (Backend - Node.js)
│   ├── server.js                 # Main server - Express + Socket.IO
│   ├── eventBus.js               # Event-driven architecture core
│   ├── firebase-helpers.js       # Firebase integration
│   └── handlers/                 # Event handlers (separation of concerns)
│       ├── analyticsHandler.js   # Firebase analytics events
│       └── leaderboardHandler.js # Leaderboard update events
│
├── 🌐 CLIENT LAYER (Frontend - HTML/CSS/JS)
│   └── public/
│       │
│       ├── 📄 HTML PAGES
│       │   ├── index.html            # Landing page (entry point)
│       │   ├── host.html             # Host mode selector
│       │   ├── host-reflex.html      # Reflex game host screen
│       │   ├── player.html           # Player entry page
│       │   ├── player-reflex.html    # Reflex game player screen
│       │   ├── conquest-host.html    # Conquest mode host
│       │   ├── conquest-player.html  # Conquest mode player
│       │   └── debug-conquest.html   # Debug/test page
│       │
│       ├── 🎨 CSS (Styling)
│       │   ├── shared.css            # Common styles
│       │   ├── host.css              # Host-specific styles
│       │   ├── player.css            # Player-specific styles
│       │   └── conquest.css          # Conquest mode styles
│       │
│       ├── ⚡ JAVASCRIPT (Client Logic)
│       │   ├── utils.js              # Shared utilities
│       │   ├── host.js               # Host game logic
│       │   ├── player.js             # Player game logic
│       │   ├── conquest-host.js      # Conquest host logic
│       │   └── conquest-game.js      # Conquest game logic
│       │
│       └── 🖼️ ASSETS
│           ├── controller-icon-v2.png
│           ├── student-icon.png
│           └── mario_spritesheet.png
│
├── 📦 BUILD & DISTRIBUTION
│   ├── build.js                  # Build script (minification)
│   └── dist/                     # Production build output
│
└── 📚 DOCUMENTATION
    ├── README.md                 # Main documentation
    ├── docs/                     # GitHub Pages docs
    └── Reflex_Royale_Documentation/
```

---

## 🔄 System Activity Diagram

### Overall Architecture

```mermaid
flowchart TB
    subgraph CLIENT["🌐 CLIENT LAYER"]
        LANDING["index.html<br/>Landing Page"]
        HOST_PAGE["host.html<br/>Host Login"]
        PLAYER_PAGE["player.html<br/>Player Entry"]
        HOST_GAME["host-reflex.html<br/>Game Screen"]
        PLAYER_GAME["player-reflex.html<br/>Game Screen"]
    end
    
    subgraph SERVER["🖥️ SERVER LAYER"]
        EXPRESS["Express.js<br/>Static Files & API"]
        SOCKET["Socket.IO<br/>Real-time Events"]
        ROOMS["Rooms Map<br/>Game State"]
        EVENTBUS["EventBus<br/>Event System"]
    end
    
    subgraph HANDLERS["📦 EVENT HANDLERS"]
        ANALYTICS["analyticsHandler<br/>Firebase Tracking"]
        LEADERBOARD["leaderboardHandler<br/>Score Updates"]
    end
    
    subgraph EXTERNAL["☁️ EXTERNAL"]
        FIREBASE["Firebase<br/>Analytics & Storage"]
    end
    
    LANDING --> HOST_PAGE
    LANDING --> PLAYER_PAGE
    HOST_PAGE --> HOST_GAME
    PLAYER_PAGE --> PLAYER_GAME
    
    HOST_GAME <-->|WebSocket| SOCKET
    PLAYER_GAME <-->|WebSocket| SOCKET
    
    SOCKET --> ROOMS
    SOCKET --> EVENTBUS
    EVENTBUS --> ANALYTICS
    EVENTBUS --> LEADERBOARD
    ANALYTICS --> FIREBASE
```

---

## 🎮 Game Flow Sequence

### 1. Room Creation Flow

```mermaid
sequenceDiagram
    participant H as Host Browser
    participant S as Server
    participant R as Rooms Map
    
    H->>S: HTTP GET /host.html
    S-->>H: Return host page
    H->>S: Socket connect
    H->>S: emit("createRoom")
    S->>R: generateRoomCode()
    R-->>S: roomCode = "1234"
    S->>R: rooms.set("1234", roomData)
    S-->>H: emit("roomCreated", {roomCode})
    H->>H: Display QR + Room Code
```

### 2. Player Join Flow

```mermaid
sequenceDiagram
    participant P as Player Browser
    participant S as Server
    participant R as Rooms Map
    participant E as EventBus
    participant H as Host Browser
    
    P->>S: HTTP GET /player.html
    S-->>P: Return player page
    P->>P: Enter room code + nickname
    P->>S: Socket connect
    P->>S: emit("joinRoom", {roomCode, nickname})
    S->>R: Validate room exists
    S->>R: Add player to room
    S->>E: emit("PLAYER_JOINED")
    E->>E: analyticsHandler tracks
    S-->>P: emit("joinedRoom")
    S-->>H: emit("playerListUpdate")
    H->>H: Update player list UI
```

### 3. Game Round Flow (Reflex Mode)

```mermaid
sequenceDiagram
    participant H as Host
    participant S as Server
    participant P1 as Player 1
    participant P2 as Player 2
    participant E as EventBus
    
    H->>S: emit("startGame")
    S->>S: room.gameState = "PLAYING"
    S-->>H: emit("gameStarted")
    S-->>P1: emit("gameStarted")
    S-->>P2: emit("gameStarted")
    
    Note over S: Round 1: COLOR_TAP
    S->>S: Generate random color (RED)
    S-->>H: emit("roundStart", {type: COLOR_TAP, color: RED})
    S-->>P1: emit("roundStart", {...})
    S-->>P2: emit("roundStart", {...})
    
    P1->>S: emit("playerResponse", {response: RED})
    S->>S: Calculate score (+800)
    S->>E: emit("SCORE_UPDATED")
    E-->>H: Broadcast leaderboard
    S-->>P1: emit("responseResult", {correct: true})
    
    P2->>S: emit("playerResponse", {response: BLUE})
    S->>S: Calculate score (-200)
    S-->>P2: emit("responseResult", {correct: false})
```

### 4. Scoring Flow with EventBus

```mermaid
flowchart LR
    subgraph GAME["Game Logic"]
        RESPONSE["playerResponse<br/>handler"]
        CALC["Calculate<br/>Score"]
    end
    
    subgraph EVENTBUS["EventBus"]
        EVENT["SCORE_UPDATED<br/>event"]
    end
    
    subgraph HANDLERS["Handlers"]
        LB["leaderboardHandler<br/>- Throttle (1/sec)<br/>- Sort & broadcast"]
        AN["analyticsHandler<br/>- Track to Firebase"]
    end
    
    RESPONSE --> CALC
    CALC --> EVENT
    EVENT --> LB
    EVENT --> AN
```

---

## 📊 Data Flow

### Room State Structure

```javascript
rooms = Map {
  "1234" => {
    code: "1234",
    hostId: "socket_abc123",
    gameMode: "REFLEX",
    gameState: "WAITING" | "PLAYING" | "FINISHED",
    players: Map {
      "socket_xyz" => { id, nickname, score },
      "socket_abc" => { id, nickname, score }
    },
    currentRound: 1,
    totalRounds: 4,
    roundType: "COLOR_TAP" | "SWIPE" | "SHAKE" | "TAP_SPAM",
    roundData: { color: "RED" } | { direction: "UP" },
    roundStartTime: 1704290000000,
    responses: Map { playerId => responseData }
  }
}
```

### Event Types

| Event | Emitted By | Listened By | Purpose |
|-------|------------|-------------|---------|
| `PLAYER_JOINED` | server.js | analyticsHandler | Track new player |
| `SCORE_UPDATED` | server.js | leaderboardHandler | Update leaderboard |
| `ROUND_ENDED` | server.js | leaderboardHandler | Force leaderboard update |
| `GAME_ENDED` | server.js | analyticsHandler, leaderboardHandler | Save results, cleanup |

---

## 🔗 File Dependencies

```mermaid
flowchart TD
    subgraph SERVER
        SERVER_JS["server.js"]
        EVENTBUS["eventBus.js"]
        ANALYTICS["handlers/analyticsHandler.js"]
        LEADERBOARD["handlers/leaderboardHandler.js"]
        FIREBASE["firebase-helpers.js"]
    end
    
    SERVER_JS --> EVENTBUS
    SERVER_JS --> ANALYTICS
    SERVER_JS --> LEADERBOARD
    SERVER_JS --> FIREBASE
    ANALYTICS --> EVENTBUS
    LEADERBOARD --> EVENTBUS
    ANALYTICS --> FIREBASE
```

---

## 🚀 Startup Sequence

```mermaid
sequenceDiagram
    participant NODE as Node.js
    participant SERVER as server.js
    participant FB as firebase-helpers
    participant EB as eventBus
    participant AH as analyticsHandler
    participant LH as leaderboardHandler
    
    NODE->>SERVER: require('./server.js')
    SERVER->>FB: require('./firebase-helpers')
    FB-->>SERVER: Firebase helpers loaded
    SERVER->>EB: require('./eventBus')
    SERVER->>AH: require('./handlers/analyticsHandler')
    SERVER->>LH: require('./handlers/leaderboardHandler')
    
    Note over SERVER: Create rooms Map
    
    SERVER->>AH: init(firebaseHelpers)
    AH->>EB: Register event listeners
    SERVER->>LH: init(io, rooms)
    LH->>EB: Register event listeners
    
    SERVER->>SERVER: http.listen(3000)
    Note over SERVER: ✅ Server ready!
```

---

## 📱 Page Navigation Map

```mermaid
flowchart TD
    INDEX["🏠 index.html<br/>Landing Page"]
    
    INDEX -->|"Host Game"| HOST["👑 host.html<br/>Host Login"]
    INDEX -->|"Join Game"| PLAYER["🎮 player.html<br/>Enter Room Code"]
    
    HOST -->|"Reflex Mode"| HOST_REFLEX["🎯 host-reflex.html"]
    HOST -->|"Conquest Mode"| HOST_CONQUEST["⚔️ conquest-host.html"]
    
    PLAYER -->|"Join Reflex"| PLAYER_REFLEX["📱 player-reflex.html"]
    PLAYER -->|"Join Conquest"| PLAYER_CONQUEST["📱 conquest-player.html"]
    
    HOST_REFLEX <-.->|"Socket.IO"| PLAYER_REFLEX
    HOST_CONQUEST <-.->|"Socket.IO"| PLAYER_CONQUEST
```
