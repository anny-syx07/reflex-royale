# 🎮 Reflex Royale

> Real-time multiplayer reflex game built with Node.js & Socket.IO

[![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge)](https://reflex-royale.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

## 📖 Giới Thiệu

**Reflex Royale** là game multiplayer tương tác thời gian thực, được thiết kế cho các sự kiện, lớp học và hoạt động nhóm. Game hỗ trợ đến **500+ người chơi** cùng lúc!

### ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **2 Game Modes** | Reflex Battle & Campus Conquest |
| ⚡ **Real-time** | Powered by Socket.IO |
| 📱 **Mobile-first** | Touch, swipe, shake detection |
| 🔥 **Firebase Integration** | Player tracking & leaderboards |
| 🛡️ **Production Security** | Helmet.js, Rate limiting, Input validation |
| 🌐 **Multi-platform** | Deploy on Render, Railway, or self-host |

---

## 🚀 Quick Start (3 bước)

### 1️⃣ Clone & Install

```bash
git clone https://github.com/anny-syx07/reflex-royale.git
cd reflex-royale
npm install
```

### 2️⃣ Run Locally

```bash
npm start
# Hoặc: node server.js
```

Server chạy tại: `http://localhost:3000`

### 3️⃣ Play!

- **Host**: Mở `http://localhost:3000/host.html`
- **Players**: Mở `http://localhost:3000/player.html` (trên mobile)

---

## 🎮 Game Modes

### ⚡ Reflex Battle
Kiểm tra phản xạ với 4 mini-games:
- 🔴 **Color Tap** - Chạm đúng màu
- ➡️ **Swipe** - Vuốt đúng hướng
- 📱 **Shake** - Lắc điện thoại
- 👆 **Tap Spam** - Chạm liên hoàn

**Duration**: ~5 phút | **Players**: 2-500+

### 🏛️ Campus Conquest
Chiến thuật chiếm lãnh thổ trên bản đồ 10x10:
- Mỗi vòng: 3 action points
- Tránh xung đột với đối thủ
- Chiếm ô đặc biệt x2, x3 điểm

**Duration**: ~8 phút | **Players**: 2-500

---

## 📂 Project Structure

```
reflex-royale/
├── server.js              # Core server logic
├── firebase-helpers.js    # Database integration
├── package.json           # Dependencies
├── public/                # Client-side files
│   ├── index.html         # Landing page
│   ├── host.html          # Mode selection
│   ├── host-reflex.html   # Reflex host
│   ├── conquest-host.html # Conquest host
│   ├── player.html        # Player join
│   ├── player-reflex.html # Reflex player
│   ├── conquest-player.html # Conquest player
│   ├── css/               # Stylesheets
│   └── js/                # Client scripts
├── .platform/             # Hosting configs
│   ├── render/
│   └── railway/
└── docs/                  # Documentation
    ├── ARCHITECTURE.md
    ├── DEVELOPMENT.md
    ├── HOSTING_GUIDE.md
    └── PLATFORM_GUIDE.md
```

📐 **Xem chi tiết**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### 📚 Tài liệu kỹ thuật (Technical Documentation)
- [Hệ thống Kiến trúc (Architecture)](docs/technical/ARCHITECTURE_DETAILED.md)
- [Triển khai Backend (Backend Implementation)](docs/technical/BACKEND_IMPLEMENTATION.md)
- [Cơ chế Game (Game Mechanics)](docs/technical/GAME_MECHANICS.md)
- [Hệ thống Database (Database Systems)](docs/technical/DATABASE_SYSTEMS.md)
- [Bảo mật & Hiệu suất (Security & Performance)](docs/technical/SECURITY_AND_PERFORMANCE.md)
- [Ý tưởng Cấu trúc (Structural Ideas)](docs/technical/STRUCTURAL_IDEAS.md)

### 🎓 Dành cho Sinh viên (For Students)
- [Hướng dẫn Hiện đại hóa (Modernization Guide)](docs/modernization_guide.md) - Cách chuyển sang Next.js & TypeScript.
- [Lộ trình Học tập (Learning Roadmap)](docs/STUDENT_ROADMAP.md) - Kế hoạch 8 tuần để làm chủ công nghệ mới.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express.js |
| **Real-time** | Socket.IO |
| **Database** | Firebase (Firestore) |
| **Security** | Helmet.js, Rate Limiting, XSS Prevention |
| **Frontend** | Vanilla JS, CSS3 |
| **Hosting** | Render, Railway |

---

## 🌐 Deployment

### Option 1: Render (Free Tier) ⭐

```bash
# 1. Push to GitHub
git push origin main

# 2. Deploy on Render
# - Connect GitHub repo
# - Deploy from .platform/render/render.yaml
```

### Option 2: Railway

```bash
# Use .platform/railway/railway.toml
railway up
```

📘 **Chi tiết**: [docs/HOSTING_GUIDE.md](docs/HOSTING_GUIDE.md)

---

## 🔧 Development

### Setup Environment

```bash
# Optional: Firebase credentials
cp firebase-service-account.json.example firebase-service-account.json
# Edit with your Firebase credentials
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `3000` | Server port |
| `HOST_PASSWORD` | ⚠️ | `WelcometoUMT` | Host authentication |
| `FIREBASE_SERVICE_ACCOUNT` | ❌ | - | Firebase JSON credentials |

### Local Development

```bash
npm start
# Server auto-restarts on file changes
```

📖 **Xem thêm**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

---

## 📱 Cách Chơi

### Cho Host (Người tổ chức)

1. Mở `host.html`
2. Nhập password: `WelcometoUMT`
3. Chọn game mode
4. Chia sẻ room code với players
5. Bấm "Bắt Đầu" khi đủ người

### Cho Player (Người chơi)

1. Mở `player.html` trên mobile
2. Nhập tên & room code
3. Chờ host bắt đầu
4. Làm theo hướng dẫn trên màn hình!

---

## 🛡️ Security Features

- ✅ **Helmet.js** - HTTP security headers
- ✅ **Rate Limiting** - DDoS protection
- ✅ **Input Validation** - XSS prevention
- ✅ **CORS** - Configured origins
- ✅ **Socket.IO Security** - Connection limits
- ✅ **Security Logging** - Audit trail

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Max concurrent players | 500+ |
| Avg latency | <50ms (Singapore) |
| Cold start (Render free) | ~30s |
| Active server latency | <10ms |

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork repo
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **GitHub Issues**: [Report Bug](https://github.com/anny-syx07/reflex-royale/issues)
- **Email**: trbui9696@gmail.com

---

## 🙏 Acknowledgments

- Built for **University of Montana** events
- Powered by **Socket.IO**, **Firebase**, **Render**

---

<p align="center">
  Made with ❤️ for real-time multiplayer fun
</p>
