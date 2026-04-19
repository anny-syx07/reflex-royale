/**
 * 📚 KIẾN THỨC: Socket.IO Client Singleton
 *
 * "Singleton" = chỉ tạo 1 instance duy nhất, dùng đi dùng lại.
 *
 * Vấn đề trong code cũ:
 *   const socket = io(); // Mỗi file tự tạo connection riêng → nhiều connection
 *
 * Giải pháp:
 *   - Lần đầu gọi getSocket() → tạo connection mới
 *   - Những lần sau → trả về connection cũ (đã có sẵn)
 *
 * Điều này quan trọng vì Next.js có thể render component nhiều lần
 * (do React Strict Mode, hot reload, v.v.)
 */

import { io, Socket } from "socket.io-client";

// Biến lưu singleton instance
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    // Kết nối tới Express server (port 3000)
    // Trong production, thay bằng URL thật của server
    const serverUrl =
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

    socket = io(serverUrl, {
      // Reconnect tự động nếu mất kết nối
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Timeout
      timeout: 10000,
    });

    // Log để debug (chỉ hiện trong browser console)
    socket.on("connect", () => {
      console.log("🔌 Socket.IO connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("🔴 Socket.IO connection error:", error.message);
    });
  }

  return socket;
}

// Dùng khi cần ngắt kết nối hoàn toàn
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket.IO manually disconnected");
  }
}
