# Database Systems & Analytics

Reflex Royale supports a dual-database integration, allowing flexibility between NoSQL (Firebase) and SQL (Supabase) providers.

## 🗄️ Database Integration Logic

The system is designed to gracefully degrade if one or both database providers are unavailable. Logic in `server.js` wraps database calls:

```javascript
const trackPlayer = async (id, nickname) => {
  if (firebaseHelpers) await firebaseHelpers.trackPlayer(id, nickname);
  if (supabaseHelpers) await supabaseHelpers.trackPlayer(id, nickname);
};
```

### 1. Firebase (Firestore)
- **Schema**:
  - `players`: Document per player ID tracking `totalScore`, `gamesPlayed`, and `lastPlayed`.
  - `gameHistory`: Log of finished games with `roomCode`, `mode`, `winner`, and full `leaderboard` data.
- **Key Feature**: Native support for atomic increments via `FieldValue.increment()`.

### 2. Supabase (PostgreSQL)
- **Schema**:
  - `players` table: `id`, `username`, `total_score`, `created_at`.
  - `game_sessions` table: `room_code`, `mode`, `winner_id`, `game_data` (JSONB).
- **Key Feature**: Relational integrity and JSONB support for complex game state snapshots.

---

## 📊 Analytics & Leaderboards

Rather than burdening the main game loop with database I/O, Reflex Royale uses a dedicated **Handler Architecture**.

### Analytics Handler (`handlers/analyticsHandler.js`)
- Subscribes to `PLAYER_JOINED` and `GAME_ENDED` events.
- Performs asynchronous writes to Firebase/Supabase.
- Ensures game latency isn't affected by database response times.

### Leaderboard Handler (`handlers/leaderboardHandler.js`)
This handler manages the real-time "Broadcast Storm" problem:
- **Throttling**: During intense rounds (like Tap Spam), hundreds of score updates can happen per second. The handler limits broadcasts to once per 1000ms.
- **Sorting**: Performs server-side sorting of the top 10 players before emitting to ensure the host display is always consistent.
- **Bypass**: Emits immediately on `ROUND_ENDED` or `GAME_ENDED` to ensure final results are instantaneous.

---

## 🔑 Authentication

- **Host Authentication**: Protected by a server-side `HOST_PASSWORD`.
- **Session Management**: Uses basic Socket IDs for session tracking, with a 60-second grace period for host socket reconnections.
