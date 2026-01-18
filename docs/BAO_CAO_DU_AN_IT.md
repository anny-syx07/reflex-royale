# 📋 BÁO CÁO DỰ ÁN REFLEX ROYALE

> **Dành cho Đại học UMT**  
> Ngày tạo: 16/01/2026

---

## 1. TỔNG QUAN DỰ ÁN

| Thông tin | Chi tiết |
|-----------|----------|
| **Tên dự án** | Reflex Royale |
| **Loại ứng dụng** | Game multiplayer thời gian thực |
| **Mục đích** | Tổ chức sự kiện, hoạt động nhóm, lớp học tương tác |
| **Số người chơi tối đa** | 500+ đồng thời |
| **Production URL (Primary)** | https://reflex-royale-production.up.railway.app |
| **Production URL (Backup)** | https://reflex-royale.onrender.com |
| **Repository** | https://github.com/anny-syx07/reflex-royale |

---

## 2. CHẾ ĐỘ CHƠI

### ⚡ Reflex Battle
Kiểm tra phản xạ nhanh với 4 mini-games:

| Mini-game | Mô tả |
|-----------|-------|
| 🔴 Color Tap | Chạm đúng màu hiển thị |
| ➡️ Swipe | Vuốt đúng hướng chỉ định |
| 📱 Shake | Lắc điện thoại tích lũy điểm |
| 👆 Tap Spam | Chạm liên tục trong thời gian giới hạn |

**Thời lượng:** ~5 phút/game

### 🏛️ Campus Conquest
Chiến thuật chiếm lãnh thổ trên bản đồ 10x10:
- Mỗi vòng: 3 action points
- Ô đặc biệt: x2, x3 điểm
- Xung đột cell tự động cancel

**Thời lượng:** ~8 phút/game

---

## 3. KIẾN TRÚC HỆ THỐNG

### 3.1 Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  HOST DEVICE  │         │ PLAYER DEVICE │         │ PLAYER DEVICE │
│  (Projector)  │         │   (Mobile)    │         │   (Mobile)    │
│               │         │               │         │               │
│ host.html     │         │ player.html   │         │ player.html   │
│ QR Code       │         │ Touch/Swipe   │         │ Touch/Swipe   │
│ Leaderboard   │         │ Shake detect  │         │ Shake detect  │
└───────┬───────┘         └───────┬───────┘         └───────┬───────┘
        │                         │                         │
        │         WebSocket (Socket.IO) - Real-time         │
        └─────────────────────────┼─────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NODE.JS SERVER (Express)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Helmet    │  │ Rate Limit  │  │     XSS     │  │     HPP     │         │
│  │  Security   │  │ Protection  │  │   Filter    │  │ Protection  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │                        GAME LOGIC (server.js)                      │      │
│  │  • Room Management (create, join, leave)                           │      │
│  │  • Game State Machine (WAITING → PLAYING → FINISHED)               │      │
│  │  • Score Calculation & Validation                                  │      │
│  │  • Round Types: COLOR_TAP, SWIPE, SHAKE, TAP_SPAM                 │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │    EventBus.js      │  │ analyticsHandler.js │  │leaderboardHandler.js│  │
│  │  Event-driven arch  │  │  Firebase tracking  │  │  Real-time ranking  │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIREBASE FIRESTORE (Cloud)                           │
│  • Player tracking                                                           │
│  • Game sessions                                                             │
│  • Leaderboard history                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Luồng dữ liệu (Data Flow)

```
1. HOST TẠO PHÒNG
   Host → createRoom → Server tạo roomCode → Trả về roomCode + QR Code

2. PLAYER THAM GIA
   Player quét QR → joinRoom(roomCode, nickname) → Server validate → Broadcast playerList

3. BẮT ĐẦU GAME
   Host nhấn Start → Server gửi roundStart → Players nhận challenge → Players gửi response

4. TÍNH ĐIỂM
   Server nhận response → Validate → Tính điểm (dựa vào thời gian + độ chính xác) → Update leaderboard

5. KẾT THÚC
   Sau tất cả vòng → Server gửi gameOver + finalLeaderboard → Lưu Firebase
```

---

## 6. CẤU TRÚC THƯ MỤC

```
reflex-royale/
│
├── 📄 server.js                    # Core server logic (1110 lines, 34KB)
├── 📄 firebase-helpers.js          # Firebase Firestore integration (3.7KB)
├── 📄 eventBus.js                  # Event-driven pub/sub system (2KB)
├── 📄 build.js                     # Production build + obfuscation (10KB)
├── 📄 package.json                 # Dependencies & scripts
├── 📄 railway.toml                 # Railway deployment config
├── 📄 render.yaml                  # Render deployment config (backup)
│
├── 📁 handlers/                    # Modular event handlers
│   ├── analyticsHandler.js         # Player tracking → Firebase (2KB)
│   └── leaderboardHandler.js       # Real-time leaderboard (2.3KB)
│
├── 📁 public/                      # Source files (development)
│   ├── 🌐 index.html               # Landing page (14.7KB)
│   ├── 🌐 host.html                # Mode selection + password (6.1KB)
│   ├── 🌐 host-reflex.html         # Reflex Battle host screen (3.7KB)
│   ├── 🌐 conquest-host.html       # Campus Conquest host screen (7.1KB)
│   ├── 🌐 player.html              # Player join page (4.2KB)
│   ├── 🌐 player-reflex.html       # Reflex Battle player (4.1KB)
│   ├── 🌐 conquest-player.html     # Campus Conquest player (17.4KB)
│   │
│   ├── 📁 css/                     # Stylesheets (~26KB total)
│   │   ├── shared.css              # Common styles (3.4KB)
│   │   ├── host.css                # Host-specific (8.6KB)
│   │   ├── player.css              # Player-specific (7KB)
│   │   └── conquest.css            # Conquest mode (7.3KB)
│   │
│   ├── 📁 js/                      # Client scripts (~46KB total)
│   │   ├── host.js                 # Reflex host logic (12.8KB)
│   │   ├── player.js               # Player game logic (12.7KB)
│   │   ├── conquest-host.js        # Conquest host (10.8KB)
│   │   ├── conquest-game.js        # Conquest game core (7KB)
│   │   └── utils.js                # Shared utilities (2.4KB)
│   │
│   └── 📁 assets/                  # Images & icons
│       ├── logo-umt.png
│       ├── controller-icon-v2.png
│       └── student-icon.png
│
├── 📁 dist/                        # Production build (obfuscated + minified)
│   └── [Same structure as public/, but optimized]
│
└── 📁 docs/                        # Documentation
    ├── ARCHITECTURE.md             # Technical architecture
    ├── DEVELOPMENT.md              # Development guide
    ├── PLATFORM_GUIDE.md           # Hosting comparison
    └── BAO_CAO_DU_AN_IT.md         # This report
```

### Thống kê mã nguồn

| Loại | Số file | Tổng size |
|------|---------|-----------|
| JavaScript (Server) | 4 | ~50KB |
| JavaScript (Client) | 5 | ~46KB |
| HTML | 8 | ~57KB |
| CSS | 4 | ~26KB |
| **Tổng cộng** | **21** | **~179KB** |

---

## 7. DEPLOYMENT

### Railway Configuration
```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/"

[variables]
NODE_ENV = "production"
```

### Environment Variables
| Variable | Required | Mô tả |
|----------|----------|-------|
| PORT | ❌ | Default: 3000 |
| HOST_PASSWORD | ⚠️ | Default: WelcometoUMT |
| FIREBASE_SERVICE_ACCOUNT | ❌ | Firebase credentials (JSON) |

### 🔄 BACKUP PLAN: Chuyển sang Render khi Railway hết free

> ⚠️ **Railway free tier chỉ có $5 credit (~500 giờ)**. Khi hết → dùng Render đã deploy sẵn!

| Platform | URL | Trạng thái |
|----------|-----|------------|
| **Railway** (Primary) | https://reflex-royale-production.up.railway.app | ✅ Đang dùng |
| **Render** (Backup) | https://reflex-royale.onrender.com | ✅ Đã deploy sẵn |

#### So sánh
| Tiêu chí | Railway | Render |
|----------|---------|--------|
| **Free tier** | $5 credit (1 tháng) | Vĩnh viễn (750h/tháng) |
| **Cold start** | ❌ Không | ⚠️ ~30 giây |
| **Chi phí sau free** | $5/tháng | $7/tháng |

#### Khi Railway hết → Chỉ cần đổi URL!
- **Host**: `https://reflex-royale.onrender.com/host.html`
- **Player**: `https://reflex-royale.onrender.com/player.html`

> 💡 **Lưu ý Render**: Sleep sau 15 phút không có traffic. Dùng [UptimeRobot](https://uptimerobot.com) ping mỗi 5 phút để giữ active.

---

## 8. TÍNH NĂNG NỔI BẬT

### ✅ Đã triển khai
- [x] 2 game modes (Reflex Battle + Campus Conquest)
- [x] QR Code tự động tạo cho join room
- [x] Real-time leaderboard cập nhật live
- [x] Host reconnection với 60s grace period
- [x] Soft reset (giữ players, reset game)
- [x] Mobile-first design (touch, swipe, shake)
- [x] Firebase integration cho tracking
- [x] Code obfuscation cho production
- [x] Security headers & rate limiting

### 🔮 Có thể mở rộng
- [ ] Admin dashboard
- [ ] Nhiều game modes hơn
- [ ] Tournament mode
- [ ] Custom branding per event

---

## 9. HIỆU NĂNG

| Metric | Value |
|--------|-------|
| Max concurrent players | 500+ |
| Avg latency (Singapore) | <50ms |
| Cold start (free tier) | ~30s |
| Active server latency | <10ms |
| Build size (obfuscated) | ~500KB total |

---

## 10. CÁCH SỬ DỤNG

### Cho Host (Người tổ chức)
1. Truy cập: `https://reflex-royale-production.up.railway.app/host.html`
2. Nhập password: `WelcometoUMT`
3. Chọn mode: Reflex Battle hoặc Campus Conquest
4. Chia sẻ Room Code hoặc QR code cho sinh viên
5. Nhấn "Bắt Đầu" khi đủ người

### Cho Player (Sinh viên)
1. Quét QR code từ màn hình host HOẶC
2. Truy cập: `https://reflex-royale-production.up.railway.app/player.html`
3. Nhập tên và room code
4. Làm theo hướng dẫn trên màn hình

---

## 11. LIÊN HỆ HỖ TRỢ

| Kênh | Thông tin |
|------|-----------|
| Email | trbui9696@gmail.com |
| GitHub Issues | https://github.com/anny-syx07/reflex-royale/issues |
| Documentation | /docs/ folder trong repository |

---

## 12. LICENSE

MIT License - Cho phép sử dụng, sao chép, chỉnh sửa tự do.

---

*Báo cáo được tạo tự động bởi hệ thống, ngày 16/01/2026*
