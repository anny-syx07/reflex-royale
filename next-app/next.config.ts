import type { NextConfig } from "next";

/**
 * 📚 KIẾN THỨC: next.config.ts
 *
 * Đây là file cấu hình của Next.js.
 * 
 * Vì Socket.IO chạy trên Express (port 3000) còn Next.js chạy trên port 3001,
 * ta cần "proxy" — tức là khi browser gọi /socket.io/..., 
 * Next.js sẽ tự forward sang Express server thay vì báo lỗi 404.
 * 
 * rewrites() = "Nếu URL bắt đầu bằng /socket.io, chuyển sang server khác"
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3000/socket.io/:path*",
      },
      {
        source: "/api/game/:path*",
        destination: "http://localhost:3000/api/:path*",
      },
      {
        source: "/verify-host-password",
        destination: "http://localhost:3000/verify-host-password",
      },
    ];
  },
};

export default nextConfig;
