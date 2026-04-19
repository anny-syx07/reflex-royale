"use client";

/**
 * 📚 KIẾN THỨC: Player Join Page
 * file: app/player/page.tsx ← player.html
 *
 * Trang này: player nhập mã phòng và nickname để vào game.
 *
 * Khái niệm mới:
 * - useSearchParams: đọc query string từ URL (?roomCode=1234)
 * - Multi-step form bằng state (thay vì show/hide div bằng display:none)
 * - Avatar URL tạo động từ nickname
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getSocket } from "@/lib/socket";

// Tách logic vào component riêng vì useSearchParams cần Suspense
function PlayerJoinContent() {
  const router = useRouter();
  /**
   * 📚 KIẾN THỨC: useSearchParams
   *
   * Dùng để đọc query params từ URL.
   * Ví dụ URL: /player?roomCode=1234
   *    searchParams.get('roomCode') → "1234"
   *
   * Tương đương code cũ:
   *    const urlParams = new URLSearchParams(window.location.search);
   *    const code = urlParams.get('roomCode');
   */
  const searchParams = useSearchParams();

  // Step 1: nhập mã phòng, Step 2: nhập nickname
  const [step, setStep] = useState<1 | 2>(1);
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  // Avatar URL tạo từ nickname (dicebear API)
  const avatarUrl = nickname
    ? `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(nickname)}`
    : "https://api.dicebear.com/9.x/pixel-art/png?seed=Player";

  // Nếu có roomCode trong URL (quét QR) → auto skip sang step 2
  useEffect(() => {
    const codeFromUrl = searchParams.get("roomCode");
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase());
      setStep(2);
    }
  }, [searchParams]);

  function handleNextStep() {
    if (roomCode.trim().length < 4) {
      setError("Mã phòng phải có 4 ký tự!");
      return;
    }
    setError("");
    setStep(2);
  }

  function handleJoinRoom() {
    const code = roomCode.trim().toUpperCase();
    const name = nickname.trim() || "Player";

    if (!code) {
      setError("Vui lòng nhập mã phòng!");
      setStep(1);
      return;
    }

    setIsConnecting(true);
    setError("Đang kết nối...");

    /**
     * 📚 KIẾN THỨC: Dùng Socket.IO trong React
     *
     * Gọi getSocket() để lấy socket singleton.
     * socket.emit() = gửi event lên server.
     * Tham số 3 là callback (server gọi lại khi có kết quả).
     *
     * Sau khi nhận response từ server:
     * → Dùng router.push() để chuyển trang (SPA navigation)
     * → Truyền data qua URL query params
     */
    const socket = getSocket();
    socket.emit("checkRoomMode", { roomCode: code }, (response: any) => {
      setIsConnecting(false);

      if (response.error) {
        setError(response.error);
        return;
      }

      // Encode params để truyền sang trang game
      const params = new URLSearchParams({
        roomCode: code,
        nickname: name,
        avatar: avatarUrl,
      });

      // Chuyển sang trang game tương ứng
      if (response.gameMode === "CONQUEST") {
        router.push(`/game/conquest-player?${params}`);
      } else {
        router.push(`/game/player?${params}`);
      }
    });
  }

  return (
    <div className="bg-mario-sky min-h-screen relative overflow-hidden">
      {/* Clouds */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <Cloud className="top-[8%]" style={{ animationDuration: "35s" }} />
        <Cloud className="top-[20%]" style={{ animationDuration: "45s", animationDelay: "8s", transform: "scale(1.2)" }} />
        <Cloud className="top-[12%]" style={{ animationDuration: "40s", animationDelay: "20s", transform: "scale(0.8)" }} />
      </div>

      {/* Question Blocks */}
      <div className="question-block fixed z-[7]" style={{ bottom: 250, left: "15%" }}>?</div>
      <div className="question-block fixed z-[7]" style={{ bottom: 160, right: "8%" }}>?</div>

      {/* Platforms */}
      <div className="fixed z-[6]" style={{ bottom: 120, right: "10%" }}>
        {[0, 1, 2].map(i => <PlatformBlock key={i} />)}
      </div>
      <div className="fixed z-[6]" style={{ bottom: 200, left: "5%" }}>
        {[0, 1].map(i => <PlatformBlock key={i} />)}
      </div>

      {/* Mario */}
      <div
        className="fixed z-[8]"
        style={{
          bottom: 125, width: 35, height: 47,
          backgroundImage: "url('/mario_spritesheet.png')",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          animation: "runMario 12s linear infinite, marioSprite 0.5s steps(8) infinite",
        }}
      />

      {/* Ground */}
      <div className="fixed bottom-0 left-0 w-full z-[5]">
        <div className="h-10 bg-[#8b5a2b] border-t-8 border-[#228b22]" />
        <div
          className="h-20"
          style={{
            background: "repeating-linear-gradient(90deg, #cd853f 0px, #cd853f 40px, #8b4513 40px, #8b4513 80px)",
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pb-40 pt-12">
        {/* Pixel panel */}
        <div className="pixel-panel p-10 max-w-sm w-full text-center relative">
          {/* Corner decorations */}
          <span className="absolute w-4 h-4 bg-yellow-400 border-4 border-black -top-3 -left-3" />
          <span className="absolute w-4 h-4 bg-yellow-400 border-4 border-black -top-3 -right-3" />

          {/**
           * 📚 KIẾN THỨC: Conditional Rendering với map
           *
           * Thay vì 2 div riêng biệt với display:none,
           * ta render step tương ứng dựa trên state `step`.
           *
           * step === 1 → render Step1 component
           * step === 2 → render Step2 component
           */}
          {step === 1 ? (
            // ===== STEP 1: Nhập mã phòng =====
            <div>
              <h1 className="text-[#5a3a2a] font-pixel text-lg mb-2" style={{ textShadow: "3px 3px 0px #000" }}>
                🎮 THAM GIA PHÒNG
              </h1>
              <p className="text-white font-pixel text-[10px] mb-8" style={{ textShadow: "2px 2px 0px #000" }}>
                Nhập mã phòng để chơi
              </p>

              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleNextStep()}
                placeholder="Mã 4 số"
                maxLength={4}
                className="w-full p-4 font-pixel text-sm border-4 border-black text-center uppercase mb-4 focus:outline-none focus:border-yellow-400"
              />

              <button
                onClick={handleNextStep}
                className="btn-pixel w-full py-5 text-sm bg-[#228b22] text-white"
              >
                TIẾP TỤC ▶
              </button>
            </div>
          ) : (
            // ===== STEP 2: Nhập nickname =====
            <div>
              <h1 className="text-[#5a3a2a] font-pixel text-lg mb-2" style={{ textShadow: "3px 3px 0px #000" }}>
                👤 TÊN CỦA BẠN
              </h1>
              <p className="text-white font-pixel text-[10px] mb-6" style={{ textShadow: "2px 2px 0px #000" }}>
                Nhập tên để mọi người nhận ra bạn
              </p>

              {/* Avatar preview — cập nhật real-time khi gõ */}
              <div className="flex justify-center mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 border-4 border-black bg-white"
                />
              </div>

              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                placeholder="Tên hiển thị"
                className="w-full p-4 font-pixel text-sm border-4 border-black text-center mb-4 focus:outline-none focus:border-yellow-400"
                autoFocus
              />

              <button
                onClick={handleJoinRoom}
                disabled={isConnecting}
                className="btn-pixel w-full py-5 text-sm bg-[#228b22] text-white disabled:opacity-50 mb-3"
              >
                VÀO GAME 🚀
              </button>

              <button
                onClick={() => { setStep(1); setError(""); }}
                className="btn-pixel w-full py-3 text-[10px] bg-gray-600 text-white"
              >
                ⬅ QUAY LẠI
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-[#ff6b6b] font-pixel text-[10px] mt-4" style={{ textShadow: "1px 1px 0px #000" }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* CSS for Mario animations */}
      <style jsx global>{`
        .question-block {
          width: 40px;
          height: 40px;
          background: #ffc107;
          border: 4px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          animation: blockBounce 1s ease-in-out infinite;
          font-family: 'Press Start 2P', cursive;
        }
      `}</style>
    </div>
  );
}

// Cloud component nhỏ
function Cloud({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`absolute animate-float-cloud ${className}`}
      style={{ left: -120, ...style }}
    >
      <div style={{ position: "relative", width: 96, height: 48 }}>
        <div className="absolute left-[25%] top-0 w-12 h-10 bg-white border-2 border-[#333] rounded-full" />
        <div className="absolute right-0 top-2 w-10 h-8 bg-white border-2 border-[#333] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-8 bg-white border-2 border-[#333] rounded-full" />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-8 bg-white z-[1]" />
      </div>
    </div>
  );
}

function PlatformBlock() {
  return (
    <div
      className="w-10 h-10 inline-block bg-[#cd853f] border-4 border-[#8b4513]"
    />
  );
}

// Suspense wrapper — Next.js yêu cầu khi dùng useSearchParams
export default function PlayerPage() {
  return (
    /**
     * 📚 KIẾN THỨC: Suspense
     *
     * useSearchParams() cần "Suspense boundary" vì nó là async operation.
     * Suspense cho phép React hiện fallback UI trong khi đang load data.
     *
     * Next.js yêu cầu điều này để support Static Generation.
     */
    <Suspense fallback={<div className="bg-mario-sky min-h-screen flex items-center justify-center">
      <div className="loading-spinner" />
    </div>}>
      <PlayerJoinContent />
    </Suspense>
  );
}
