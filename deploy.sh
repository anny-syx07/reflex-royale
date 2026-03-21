#!/bin/bash

# ============================================================
#  Deploy Script - Reflex Royale
#  Domain : eventgame.umt.edu.vn
#  Server : 10.11.10.33 (Ubuntu - nội bộ UMT)
#  App    : Node.js port 3000
# ============================================================

set -e  # Dừng ngay nếu có lỗi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="eventgame.umt.edu.vn"
APP_PORT=3000
NGINX_CONF="/etc/nginx/sites-available/eventgame"

echo ""
echo "============================================================"
echo "   🚀  Deploy Reflex Royale → $DOMAIN"
echo "============================================================"
echo ""

# ── 1. Kiểm tra Node.js ──────────────────────────────────────
log "Kiểm tra Node.js..."
node -v &>/dev/null || err "Node.js chưa được cài. Chạy: sudo apt install nodejs npm -y"
log "Node.js: $(node -v)"

# ── 2. Cài / cập nhật pm2 ────────────────────────────────────
log "Kiểm tra PM2..."
if ! command -v pm2 &>/dev/null; then
    warn "PM2 chưa có, đang cài..."
    npm install -g pm2
fi
log "PM2: $(pm2 -v)"

# ── 3. Cài Nginx nếu chưa có ─────────────────────────────────
log "Kiểm tra Nginx..."
if ! command -v nginx &>/dev/null; then
    warn "Nginx chưa có, đang cài..."
    sudo apt update -y
    sudo apt install nginx -y
fi
log "Nginx: $(nginx -v 2>&1)"

# ── 4. Cài dependencies & build ──────────────────────────────
log "Cài dependencies..."
cd "$APP_DIR"
npm install

log "Build app..."
npm run build

# ── 5. Tạo Nginx config ───────────────────────────────────────
log "Tạo Nginx config cho $DOMAIN..."
sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Tăng giới hạn upload (nếu cần)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;

        # Bắt buộc cho Socket.io
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeout dài cho WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

# ── 6. Kích hoạt Nginx site ───────────────────────────────────
NGINX_ENABLED="/etc/nginx/sites-enabled/eventgame"
if [ ! -L "$NGINX_ENABLED" ]; then
    sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
    log "Đã kích hoạt Nginx site"
fi

# Xoá default site nếu còn
[ -L /etc/nginx/sites-enabled/default ] && sudo rm /etc/nginx/sites-enabled/default
warn "Đã xoá Nginx default site"

# Kiểm tra config Nginx
sudo nginx -t || err "Nginx config có lỗi!"

# Reload Nginx
sudo systemctl enable nginx
sudo systemctl reload nginx
log "Nginx đã reload"

# ── 7. Khởi động app với PM2 ──────────────────────────────────
log "Khởi động app với PM2..."
cd "$APP_DIR"

# Dừng instance cũ nếu có
pm2 stop reflex-royale 2>/dev/null || true
pm2 delete reflex-royale 2>/dev/null || true

NODE_ENV=production pm2 start server.js \
    --name reflex-royale \
    --log-date-format "YYYY-MM-DD HH:mm:ss" \
    --restart-delay 3000 \
    --max-restarts 10

# Lưu và auto-start khi reboot
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null | tail -1 | sudo bash || warn "Bỏ qua pm2 startup (có thể cần chạy thủ công)"

# ── 8. Xác nhận ───────────────────────────────────────────────
echo ""
echo "============================================================"
log "Deploy thành công!"
echo ""
echo "  🌐  http://$DOMAIN"
echo "  🖥️   Host:   http://$DOMAIN/host.html"
echo "  🎮  Player: http://$DOMAIN/player.html"
echo ""
echo "  PM2 status: pm2 status"
echo "  PM2 logs  : pm2 logs reflex-royale"
echo "============================================================"
echo ""
