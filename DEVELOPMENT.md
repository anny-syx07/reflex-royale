# 🛠️ Development Guide

> Hướng dẫn setup và phát triển Reflex Royale

---

## 📋 Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | ≥16.x | `node --version` |
| npm | ≥8.x | `npm --version` |
| Git | Any | `git --version` |

---

## 🏗️ Setup Môi Trường

### 1. Clone Repository

```bash
git clone https://github.com/anny-syx07/reflex-royale.git
cd reflex-royale
```

### 2. Install Dependencies

```bash
npm install
```

**Dependencies installed** (~30MB):
- express, socket.io
- helmet, express-rate-limit, xss, hpp
- firebase-admin

### 3. Configure Firebase (Optional)

#### Option A: Local File
```bash
# Create firebase-service-account.json
# Get credentials from Firebase Console
```

#### Option B: Environment Variable
```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

**If skipped**: Game works, but no player tracking/leaderboards

### 4. Set Host Password

```bash
export HOST_PASSWORD="YourSecretPassword"
# Default: WelcometoUMT
```

### 5. Start Server

```bash
npm start
```

**Output**:
```
🔥 Firebase helpers loaded
✨ Reflex Royale server running on http://localhost:3000
📱 Host: http://localhost:3000/host.html
🎮 Player: http://localhost:3000/player.html
```

---

## 🔧 Development Workflow

### Project Structure

```
src/
├── server.js              # Start here
├── firebase-helpers.js    # Database logic
└── public/
    ├── *.html             # Pages
    ├── js/*.js            # Client logic
    └── css/*.css          # Styles
```

### Live Reload (Recommended)

```bash
# Install nodemon globally
npm install -g nodemon

# Run with auto-restart
nodemon server.js
```

Changes to `.js` files → auto-restart
Changes to `public/*` → refresh browser

### Debug Mode

```bash
# Enable verbose Socket.IO logging
DEBUG=socket.io* node server.js
```

---

## 🎨 Frontend Development

### Adding New Features

**Example: Add new round type "Memory Match"**

1. **Update server.js**
```javascript
const ROUND_TYPES = {
  // ...existing
  MEMORY_MATCH: 'MEMORY_MATCH'
};

function startNextRound(roomCode) {
  // Add to round sequence
  roundType = ROUND_TYPES.MEMORY_MATCH;
  // ...
}
```

2. **Update player.js**
```javascript
socket.on('roundStart', ({ roundType, roundData }) => {
  if (roundType === 'MEMORY_MATCH') {
    showMemoryMatchUI(roundData);
  }
});

function showMemoryMatchUI(data) {
  // Render cards
}
```

3. **Update host.js**
```javascript
function displayMemoryMatchRound(data) {
  roundDisplayEl.innerHTML = `
    <div class="memory-match-display">
      ${data.cards.map(card => `...`).join('')}
    </div>
  `;
}
```

### CSS Variables (in `shared.css`)

```css
:root {
  --color-primary: #667eea;
  --color-secondary: #764ba2;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-yellow: #fbbf24;
}
```

### Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## 🧪 Testing

### Manual Testing Checklist

**Reflex Mode**:
- [ ] Host creates room
- [ ] 2+ players join
- [ ] Game starts
- [ ] All 4 round types work
- [ ] Scores update correctly
- [ ] Leaderboard shows
- [ ] Game ends properly

**Conquest Mode**:
- [ ] Room creation
- [ ] Map displays
- [ ] Cell selection works
- [ ] Conflict resolution correct
- [ ] Territory calculation accurate

### Testing with Multiple Devices

```bash
# Find your local IP
ipconfig getifaddr en0  # Mac
ipconfig               # Windows

# Access from mobile
http://YOUR_IP:3000/player.html
```

### Automated Testing (Future)

```bash
# Install test dependencies
npm install --save-dev jest socket.io-client

# Run tests
npm test
```

---

## 🐛 Debugging

### Common Issues

#### 1. "Cannot find module..."
```bash
# Solution: Reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 2. Port already in use
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### 3. Socket.IO not connecting
**Check**:
- CORS settings in `server.js`
- Browser console for errors
- Network tab → WebSocket upgrade

**Debug**:
```javascript
// Add to client
socket.on('connect', () => console.log('✅ Connected'));
socket.on('connect_error', (err) => console.error('❌', err));
```

#### 4. Firebase not working
```bash
# Verify credentials
node -e "console.log(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))"

# Check Firebase console
# → Firestore → Rules → Allow test mode
```

### Server Logs

```javascript
// Add custom logging
console.log('[JOIN]', { roomCode, nickname, socketId });
```

**Find logs**:
- Local: Terminal output
- Render: Dashboard → Service → Logs tab
- Railway: Dashboard → Deployments → View logs

---

## 🚀 Deployment

### Pre-deployment Checklist

- [ ] Test locally
- [ ] Update `HOST_PASSWORD` env var
- [ ] Add `FIREBASE_SERVICE_ACCOUNT` if using
- [ ] Commit & push to GitHub
- [ ] Check `.gitignore` (no secrets)

### Deploy to Render

```bash
# 1. Push to GitHub
git add .
git commit -m "Feature: XYZ"
git push origin main

# 2. Render auto-deploys (if connected)
# Or manually: Render Dashboard → Deploy
```

### Deploy to Railway

```bash
railway up
```

### Environment Variables

**Render Dashboard**:
1. Service → Environment tab
2. Add:
   - `HOST_PASSWORD` = your password
   - `FIREBASE_SERVICE_ACCOUNT` = `{...JSON...}`
3. Save → Auto-redeploy

---

## 📦 Adding Dependencies

```bash
# Install package
npm install package-name

# Save to package.json
npm install --save package-name

# Dev dependency
npm install --save-dev package-name
```

**Remember to**:
- Update `package.json`
- Commit `package-lock.json`
- Test locally before deploy

---

## 🔒 Security Best Practices

### Input Validation

```javascript
// Always sanitize user input
const sanitized = sanitizeNickname(userInput);
const validated = validateRoomCode(roomCodeInput);
```

### Sensitive Data

```javascript
// ❌ NEVER commit
firebase-service-account.json

// ✅ Use environment variables
process.env.FIREBASE_SERVICE_ACCOUNT
```

### Rate Limiting

```javascript
// Already configured in server.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
```

---

## 📊 Performance Optimization

### Socket.IO

```javascript
// Emit only to specific rooms, not all
io.to(roomCode).emit('event', data);  // ✅
io.emit('event', data);               // ❌ Expensive
```

### Firebase Batch Writes

```javascript
// Instead of multiple writes
const batch = db.batch();
players.forEach(player => {
  batch.update(playerRef, { score: player.score });
});
await batch.commit();
```

### Client-Side

```javascript
// Debounce rapid events (shake, tap)
let lastSent = 0;
if (Date.now() - lastSent > 200) {
  socket.emit('shakeUpdate', data);
  lastSent = Date.now();
}
```

---

## 🎯 Code Style Guide

### JavaScript

```javascript
// Use const/let, not var
const roomCode = '1234';
let playerCount = 0;

// Arrow functions for callbacks
socket.on('event', (data) => {
  // ...
});

// Template literals
const message = `Player ${nickname} joined room ${roomCode}`;

// Destructuring
const { roomCode, nickname } = data;
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `playerScore` |
| Constants | UPPER_CASE | `MAX_PLAYERS` |
| Functions | camelCase | `generateRoomCode()` |
| Classes | PascalCase | `ConquestGrid` |
| Files | kebab-case | `conquest-player.js` |

---

## 📚 Useful Commands

```bash
# Check for unused dependencies
npm prune

# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# View dependency tree
npm ls

# Clear npm cache
npm cache clean --force
```

---

## 🤝 Contributing

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/memory-match

# Make changes
git add .
git commit -m "feat: Add memory match round type"

# Push
git push origin feature/memory-match

# Create Pull Request on GitHub
```

### Commit Message Format

```
feat: Add new round type
fix: Resolve player disconnect bug
docs: Update README
style: Format code
refactor: Simplify room logic
test: Add unit tests
chore: Update dependencies
```

---

## 📞 Getting Help

- 📖 **Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/anny-syx07/reflex-royale/issues)
- 💬 **Stack Overflow**: Tag `socket.io`, `node.js`
- 📧 **Email**: trbui9696@gmail.com

---

## ✅ Development Checklist

Before pushing code:
- [ ] Code works locally
- [ ] No console errors
- [ ] Tested on mobile (if UI changes)
- [ ] Comments added for complex logic
- [ ] Security validated (input sanitization)
- [ ] Environment variables not hardcoded

---

<p align="center">
  Happy Coding! 🚀
</p>
