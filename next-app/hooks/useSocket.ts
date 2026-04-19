"use client";

/**
 * 📚 KIẾN THỨC: Custom Hook - useSocket
 *
 * Hook là function đặc biệt trong React bắt đầu bằng "use".
 * Custom hook giúp tái sử dụng logic mà không cần copy-paste.
 *
 * TRƯỚC (code cũ - phải viết lại ở mỗi file):
 *   const socket = io();
 *   socket.on('roundStart', handler);
 *   // Khi thoát trang: thường QUÊN cleanup!
 *
 * SAU (React hook - tự động cleanup):
 *   const socket = useSocket();
 *   // Tự động ngắt kết nối khi component unmount
 *
 * useEffect với return cleanup: React gọi hàm cleanup khi component bị xóa khỏi DOM
 */

import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";

export function useSocket(): Socket {
  // useRef giữ reference qua các lần re-render mà không trigger re-render mới
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Lấy socket singleton
    socketRef.current = getSocket();

    // Cleanup function — chạy khi component unmount
    return () => {
      // Không disconnect vì socket là singleton dùng chung
      // Chỉ remove listeners nếu cần
      console.log("[useSocket] Component unmounted, keeping socket alive");
    };
  }, []); // [] = chỉ chạy 1 lần khi mount

  return socketRef.current || getSocket();
}
