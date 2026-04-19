"use client";

/**
 * 📚 KIẾN THỨC: "use client"
 *
 * Next.js App Router mặc định render mọi component trên SERVER (SSR).
 * Nhưng một số thứ chỉ có ở browser:
 *   - useState, useEffect (React hooks)
 *   - window, document
 *   - Event listeners
 *   - Socket.IO
 *
 * Khi cần dùng những thứ này → thêm "use client" ở đầu file.
 * File này cần useState (modal) → phải là "use client".
 *
 * ---
 * 📚 KIẾN THỨC: JSX vs HTML
 *
 * JSX là "HTML viết trong JavaScript/TypeScript".
 * Khác biệt chính:
 *   HTML:  class="..."    →  JSX: className="..."
 *   HTML:  onclick="fn()" →  JSX: onClick={fn}
 *   HTML:  <img>          →  JSX: <img /> (phải tự đóng tag)
 *   HTML:  style="color:red" → JSX: style={{ color: 'red' }}
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 📚 KIẾN THỨC: useState
 *
 * useState là hook quản lý state (trạng thái) trong React.
 * Khi state thay đổi → React tự động re-render UI.
 *
 * Cú pháp: const [value, setValue] = useState(initialValue);
 *   - value: giá trị hiện tại
 *   - setValue: hàm để cập nhật giá trị
 *
 * Code cũ dùng DOM manipulation:
 *   document.getElementById('modal').classList.add('active')
 *
 * Code mới dùng state:
 *   setIsModalOpen(true) → React tự render lại với modal hiện lên
 */

export default function HomePage() {
  const router = useRouter();

  // State cho modal password
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Ref cho YouTube player (không dùng state vì không cần re-render khi thay đổi)
  const playerRef = useRef<any>(null);

  /**
   * 📚 KIẾN THỨC: useEffect
   *
   * useEffect chạy "side effects" — những thứ xảy ra NGOÀI render.
   * Tương đương với window.onload trong code cũ.
   *
   * Tham số thứ 2 là dependency array:
   *   [] = chỉ chạy 1 lần sau khi component mount (như window.onload)
   *   [value] = chạy lại mỗi khi value thay đổi
   *   không có = chạy sau mỗi lần render
   */
  useEffect(() => {
    // Load YouTube IFrame API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    // YouTube API sẽ gọi hàm này khi sẵn sàng
    (window as any).onYouTubeIframeAPIReady = () => {
      const loopStart = 18;
      const loopEnd = 90;

      playerRef.current = new (window as any).YT.Player("yt-player", {
        videoId: "2AaQtoNxRB0",
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0,
          loop: 1, modestbranding: 1, rel: 0, showinfo: 0,
          mute: 1, start: loopStart, end: loopEnd,
          playlist: "2AaQtoNxRB0",
        },
        events: {
          onReady: (e: any) => {
            e.target.mute();
            e.target.playVideo();

            // Unmute khi user tương tác lần đầu
            const unmute = () => {
              playerRef.current?.unMute();
              document.body.removeEventListener("click", unmute);
              document.body.removeEventListener("touchstart", unmute);
            };
            document.body.addEventListener("click", unmute);
            document.body.addEventListener("touchstart", unmute);
          },
          onStateChange: (e: any) => {
            if (e.data === 0) { // Video ended
              playerRef.current?.seekTo(loopStart);
              playerRef.current?.playVideo();
            }
          },
        },
      });

      // Enforce loop
      setInterval(() => {
        if (playerRef.current?.getCurrentTime?.() >= loopEnd) {
          playerRef.current.seekTo(loopStart);
          playerRef.current.playVideo();
        }
      }, 1000);
    };

    // Cleanup: xóa script khi component unmount
    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []); // [] = chỉ chạy 1 lần

  async function handleVerifyPassword() {
    if (!password) {
      setError("❌ Vui lòng nhập mật khẩu!");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      /**
       * 📚 KIẾN THỨC: fetch API
       *
       * fetch() dùng để gọi HTTP request từ browser.
       * async/await giúp code trông giống đồng bộ dù thực ra bất đồng bộ.
       *
       * Không khác gì code cũ, nhưng giờ nằm trong React component
       * nên có thể dùng setState để update UI sau khi nhận response.
       */
      const res = await fetch("/verify-host-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem("hostAuth", "true");
        /**
         * 📚 KIẾN THỨC: Next.js Router
         *
         * Trong HTML cũ: window.location.href = '/host.html'
         * Trong Next.js: router.push('/host')
         *
         * Lợi ích: Không reload trang, chuyển trang mượt mà (SPA navigation)
         */
        router.push("/host");
      } else {
        setError("❌ Sai mật khẩu!");
        setPassword("");
      }
    } catch {
      setError("❌ Lỗi kết nối!");
    } finally {
      setIsLoading(false);
    }
  }

  function openModal() {
    setIsModalOpen(true);
    setError("");
    setPassword("");
  }

  function closeModal() {
    setIsModalOpen(false);
    setError("");
    setPassword("");
  }

  /**
   * 📚 KIẾN THỨC: JSX Return
   *
   * Component React PHẢI return JSX (hoặc null).
   * Chỉ được return 1 root element → dùng <> </> (Fragment) để gom nhóm.
   */
  return (
    <>
      {/* Video Background */}
      <div className="fixed inset-0 -z-10 bg-black overflow-hidden">
        <div
          id="yt-player"
          className="absolute top-1/2 left-1/2 w-screen h-screen -translate-x-1/2 -translate-y-1/2 scale-150 pointer-events-none"
        />
      </div>

      {/* Header — UMT Logo */}
      <header className="fixed top-0 left-0 w-full p-5 z-50 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-umt-new.png" alt="UMT Logo" className="h-8 w-auto" />
      </header>

      {/* Admin Button (top-right) */}
      <button
        onClick={openModal}
        title="Admin Access"
        className="fixed top-5 right-5 z-50 w-11 h-11 bg-transparent border-none cursor-pointer transition-all duration-100 active:translate-x-1 active:translate-y-1"
        style={{ filter: "drop-shadow(4px 4px 0px #000)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/admin-icon-pixel.png" alt="Admin" className="w-11 h-11" />
      </button>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pt-48 pb-24 text-center">
        {/* Wooden board panel */}
        <div
          className="relative max-w-5xl w-full flex flex-col items-center justify-center"
          style={{ padding: "100px 60px" }}
        >
          {/* Wooden frame image */}
          <div
            className="absolute inset-0 -z-20"
            style={{
              background: "url('/ui-board.png') center/100% 100% no-repeat",
            }}
          />
          {/* Semi-transparent overlay inside frame */}
          <div
            className="absolute -z-30"
            style={{
              top: 90, left: 25, right: 30, bottom: 80,
              backgroundColor: "rgba(139, 90, 43, 0.5)",
              borderRadius: 4,
            }}
          />

          {/* Pixel Title */}
          <div className="relative mb-6 animate-bounce-in">
            {/* Extrude shadow layer */}
            <span
              className="absolute top-0 left-0 text-[128px] leading-none tracking-widest whitespace-nowrap"
              style={{
                fontFamily: "'Pixel Game Extrude', 'Press Start 2P', cursive",
                color: "#25343F",
                WebkitFontSmoothing: "none",
                imageRendering: "pixelated",
              }}
            >
              GAME HUB
            </span>
            {/* Main text */}
            <h1
              className="relative text-[128px] leading-none tracking-widest whitespace-nowrap"
              style={{
                fontFamily: "'Pixel Game', 'Press Start 2P', cursive",
                background: "linear-gradient(180deg, #FFEF5F 0%, #F16D34 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                WebkitFontSmoothing: "none",
                imageRendering: "pixelated",
              }}
            >
              GAME HUB
            </h1>
          </div>

          <p
            className="text-base text-[#ffe4c4] mb-5 max-w-lg leading-relaxed"
            style={{ textShadow: "2px 2px 0px #000", fontFamily: "'Press Start 2P', cursive" }}
          >
            UMT&apos;s realtime gaming platform.
            <br />
            Learn while you play!
          </p>

          {/* JOIN ROOM Button */}
          <button
            onClick={() => router.push("/player")}
            className="relative block cursor-pointer bg-transparent border-none p-0"
          >
            {/* Shadow layer */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/btn-join-now.png"
              alt=""
              className="h-24 w-auto absolute top-1 left-1"
              style={{ filter: "brightness(0)" }}
            />
            {/* Main button */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/btn-join-now.png"
              alt="JOIN ROOM"
              className="h-24 w-auto relative transition-all duration-100 hover:brightness-110 active:translate-x-1 active:translate-y-1"
            />
          </button>
        </div>
      </main>

      {/* Admin Password Modal */}
      {/**
       * 📚 KIẾN THỨC: Conditional Rendering
       *
       * {isModalOpen && <Component />}
       * = CHỈ render Component khi isModalOpen === true
       *
       * Thay thế cho code cũ:
       * if (show) { modal.classList.add('active') }
       */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80"
          onClick={closeModal}
        >
          <div
            className="bg-[#5c94fc] p-10 border-8 border-black max-w-md w-[90%] text-center font-pixel"
            style={{ animation: "modalBounce 0.3s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-white text-lg mb-5"
              style={{ textShadow: "3px 3px 0px #000" }}
            >
              🔒 ADMIN ACCESS
            </h2>
            <p className="text-white text-[10px] leading-[1.8] mb-6" style={{ textShadow: "2px 2px 0px #000" }}>
              Nhập mật khẩu để truy cập host controls
            </p>

            {error && (
              <p className="text-[#ff6b6b] text-[10px] mb-4" style={{ textShadow: "1px 1px 0px #000" }}>
                {error}
              </p>
            )}

            <input
              type="password"
              value={password}
              /**
               * 📚 KIẾN THỨC: Controlled Input
               *
               * Trong React, input được "control" bởi state.
               * value={password} = hiển thị giá trị từ state
               * onChange={(e) => setPassword(e.target.value)} = cập nhật state khi gõ
               *
               * Khác với HTML cũ: document.getElementById('input').value
               */
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
              placeholder="Password..."
              className="w-full p-4 font-pixel text-xs border-4 border-black mb-5 text-center focus:outline-none focus:border-yellow-400"
              autoFocus
            />

            <div className="flex gap-4 justify-center">
              <button
                onClick={closeModal}
                className="btn-pixel px-6 py-4 bg-red-600 text-white text-[10px]"
              >
                Hủy
              </button>
              <button
                onClick={handleVerifyPassword}
                disabled={isLoading}
                className="btn-pixel px-6 py-4 bg-green-700 text-white text-[10px] disabled:opacity-50"
              >
                {isLoading ? "..." : "Vào"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
