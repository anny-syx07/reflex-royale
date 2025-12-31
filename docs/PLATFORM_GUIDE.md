# 🚀 Platform Configs - Reflex Royale

Folder này chứa configs cho các hosting platforms khác nhau.

## 📁 Cấu trúc

```
.platform/
├── render/          # ✅ Đang sử dụng
│   └── render.yaml  # Render blueprint
└── railway/         # 📦 Backup
    └── railway.toml # Railway config
```

---

## ⚡ So Sánh Nhanh

| Tiêu chí | Railway | Render |
|----------|---------|--------|
| **Free tier** | 1 tháng ($5 credit) | Vĩnh viễn (750h/tháng) |
| **Cold start** | ❌ Không | ⚠️ 30 giây |
| **Chi phí sau free** | $5/tháng | $7/tháng |
| **Phù hợp** | Production | Demo/Event |

> 📖 **Chi tiết đầy đủ**: Xem [docs/HOSTING_GUIDE.md](../docs/HOSTING_GUIDE.md)

---

## 🔧 Hướng Dẫn Deploy Nhanh

### Render (Khuyên dùng cho demo)

1. [render.com](https://render.com) → Đăng nhập GitHub
2. **New** → **Web Service** → Chọn repo
3. Config:
   - **Region**: Singapore
   - **Build**: `npm install`
   - **Start**: `npm start`
   - **Plan**: Free
4. **Create Web Service**

### Railway (Nếu có budget)

1. [railway.app](https://railway.app) → Đăng nhập GitHub
2. **New Project** → **Deploy from GitHub**
3. Chọn repo → Deploy tự động

---

## 🔑 Environment Variables

| Variable | Giá trị | Bắt buộc |
|----------|---------|----------|
| `PORT` | *Auto-inject* | ❌ |
| `HOST_PASSWORD` | `WelcometoUMT` | ⚠️ Có default |
| `FIREBASE_SERVICE_ACCOUNT` | JSON content | ⚠️ Nếu dùng Firebase |

---

## ⚠️ Lưu Ý Quan Trọng

### Render Free Tier:
- **Auto-sleep sau 15 phút** không có traffic
- **Cold start ~30 giây** khi wake up
- **Giải pháp**: Dùng [UptimeRobot](https://uptimerobot.com) ping mỗi 5 phút

### Railway Free Tier:
- **Chỉ $5 credit** - Đủ ~500 giờ server
- **Hết credit = ngừng hoạt động**
- **Giải pháp**: Upgrade lên Hobby ($5/tháng)

---

## 📞 Support

- **Docs đầy đủ**: [docs/HOSTING_GUIDE.md](../docs/HOSTING_GUIDE.md)
- **GitHub**: [github.com/anny-syx07/reflex-royale](https://github.com/anny-syx07/reflex-royale)

---

*Cập nhật: 30/12/2024*
