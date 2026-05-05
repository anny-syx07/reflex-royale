# Security & Performance Analysis

This document details the optimizations and security measures implemented in Reflex Royale to support 500+ concurrent players in a real-time environment.

## 🛡️ Security Measures

### 1. XSS & Injection Prevention
- **Sanitization**: All incoming user input (nicknames, chat messages) is passed through the `xss` package.
- **Strict Validation**: Room codes are validated against a numeric regex before being used as Map keys to prevent prototype pollution or unauthorized memory access.
- **CSP**: A restrictive Content Security Policy prevents the execution of unauthorized scripts and ensures only whitelisted assets are loaded.

### 2. DDoS & Flood Protection
- **Rate Limiting**: Express middleware limits the number of HTTP requests.
- **Socket Throttling**: A custom `io.use` middleware tracks connection attempts per IP. If an IP attempts more than 30 connections in 60 seconds, it is temporarily blocked.
- **Buffer Size**: `maxHttpBufferSize` is set to 1MB to prevent memory exhaustion from oversized WebSocket payloads.

---

## 🚀 Performance Optimizations

### 1. Event Throttling
- **Leaderboard Throttling**: Broadcasts are capped at 1Hz (once per second).
- **Energy Bar Optimization**: During SHAKE rounds, energy bar updates are throttled to 10Hz (once per 100ms) to maintain smooth UI without saturating the network.

### 2. Memory Management
- **Maps over Arrays**: Rooms and player lists are stored in `Map` objects, providing $O(1)$ lookup time regardless of the number of active rooms.
- **Connection Cleanup**: A periodic task (triggered by a 1% probability on new connections) cleans up the IP tracking map to prevent memory leaks from stale data.
- **Automatic Room Expiry**: Rooms are automatically deleted if the host doesn't reconnect within the 60-second grace period.

### 3. Latency Reduction
- **Fire-and-Forget Analytics**: Using the `EventBus` for analytics ensures that the main thread never waits for database confirmation.
- **Minimal Payloads**: Socket events emit only the data necessary for the UI (e.g., only top 10 for leaderboards instead of the entire player list).

## 🛠️ Network Resilience
- **Extended Timeouts**: `pingTimeout` is set to 60s to accommodate mobile devices moving between Wi-Fi and 4G/5G networks.
- **Host Persistence**: Use of `localStorage` on the host side combined with the server's `reconnectHost` event allows sessions to survive browser refreshes or accidental tab closures.
