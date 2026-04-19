"use client";

/**
 * 📚 KIẾN THỨC: Host Mode Select Page
 * file: app/host/page.tsx ← host.html
 *
 * Trang này cho host chọn game mode: Reflex hoặc Conquest.
 * Không cần Socket.IO ở đây vì chỉ là UI chọn mode.
 *
 * Khái niệm mới ở trang này:
 * - useEffect để check auth (sessionStorage)
 * - CSS Modules alternative: Tailwind + inline styles cho complex animations
 * - Conditional className: clsx pattern (dùng template literal)
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type GameMode = "reflex" | "conquest" | null;

export default function HostPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<GameMode>(null);

  /**
   * 📚 KIẾN THỨC: Auth Guard
   *
   * Khi host vào trang này, cần kiểm tra xem đã nhập đúng password chưa.
   * sessionStorage giống localStorage nhưng xóa khi đóng tab.
   *
   * Nếu chưa auth → redirect về trang chủ.
   * Cách làm trong React: dùng useEffect chạy khi mount.
   */
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("hostAuth") === "true";
    if (!isAuthenticated) {
      router.replace("/"); // replace thay vì push để không thể back về
    }
  }, [router]);

  function handleSelectMode(mode: GameMode) {
    setSelectedMode(mode);
  }

  function handleStartGame() {
    if (!selectedMode) return;

    if (selectedMode === "reflex") {
      router.push("/game/host");
    } else {
      router.push("/game/conquest-host");
    }
  }

  return (
    /**
     * 📚 KIẾN THỨC: Tailwind Utility Classes
     *
     * Mỗi class Tailwind = 1 CSS property.
     * Ví dụ:
     *   relative        = position: relative
     *   min-h-screen    = min-height: 100vh
     *   overflow-hidden = overflow: hidden
     *   z-[10]          = z-index: 10  (bracket = arbitrary value)
     *
     * Lợi ích: Không cần viết CSS file riêng, style ngay trong JSX.
     */
    <div className="relative min-h-screen overflow-hidden">
      {/* Sky gradient background */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: "linear-gradient(180deg, #4A90D9 0%, #87CEEB 50%, #E0F6FF 100%)" }}
      />

      {/* Animated halftone pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(255,255,255,0.15) 2px, transparent 2px),
            radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px, 30px 30px",
          animation: "slidePattern 60s linear infinite",
        }}
      />

      {/* Campus foreground image */}
      <div
        className="fixed inset-0 pointer-events-none z-[2]"
        style={{ background: "url('/images/umt-campus-bg.png') center bottom/cover no-repeat" }}
      />

      {/* Blur overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[3] opacity-70"
        style={{
          background: "url('/images/blur-overlay.png') 0 0/90% 90% repeat",
          animation: "blurSlide 9s linear infinite",
        }}
      />

      {/* Main container */}
      <div className="relative z-[10] min-h-screen flex items-center justify-center p-8">
        {/* Board frame with wooden border */}
        <div
          className="relative w-[90%] max-w-xl"
          style={{
            padding: "80px 40px 90px 35px",
            animation: "slideUpFade 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          {/* Wooden frame background image */}
          <div
            className="absolute inset-0 pointer-events-none z-[2]"
            style={{ background: "url('/ui-board.png') center/contain no-repeat" }}
          />

          {/* Inner transparent content area */}
          <div
            className="relative z-[1] rounded-xl p-5 flex flex-col items-center"
            style={{
              background: "rgba(139, 90, 43, 0.5)",
              backdropFilter: "blur(5px)",
            }}
          >
            {/* Title */}
            <h1
              className="relative text-transparent text-5xl mb-8 font-normal tracking-widest text-left pl-8 w-full"
              style={{ marginTop: -30 }}
            >
              {/* Extrude shadow */}
              <span
                className="absolute top-0 left-8"
                style={{
                  fontFamily: "'Pixel Game Extrude', sans-serif",
                  color: "#000",
                  zIndex: 1,
                }}
              >
                SELECT MODE
              </span>
              {/* Main text */}
              <span
                className="relative"
                style={{
                  fontFamily: "'Pixel Game', sans-serif",
                  color: "#FFD700",
                  zIndex: 2,
                }}
              >
                SELECT MODE
              </span>
            </h1>

            {/* Game selection grid */}
            <div className="flex gap-8 items-center justify-center">
              {/* Reflex Card */}
              <GameCard
                id="reflexCard"
                imageSrc="/images/reflex-icon.png"
                label={["Phản Xạ", "Cực Nhanh"]}
                isSelected={selectedMode === "reflex"}
                onClick={() => handleSelectMode("reflex")}
              />

              {/* Conquest Card */}
              <GameCard
                id="conquestCard"
                imageSrc="/images/conquest-icon.png"
                label={["Đại Chiến", "Giảng Đường"]}
                isSelected={selectedMode === "conquest"}
                onClick={() => handleSelectMode("conquest")}
              />
            </div>

            {/* Start Button - slide in when mode selected */}
            <div
              className="mt-6 overflow-hidden transition-all duration-500"
              style={{
                maxHeight: selectedMode ? 80 : 0,
                opacity: selectedMode ? 1 : 0,
              }}
            >
              <button
                onClick={handleStartGame}
                className="relative h-14 w-48 bg-transparent border-none cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/btn-start.png"
                  alt=""
                  className="absolute top-1 left-1 w-full h-full object-contain"
                  style={{ filter: "brightness(0) opacity(0.5)" }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/btn-start.png"
                  alt="Start"
                  className="absolute top-0 left-0 w-full h-full object-contain transition-transform duration-100 active:translate-x-1 active:translate-y-1"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slidePattern {
          0% { transform: translate(0, 0) rotate(0deg); }
          100% { transform: translate(50px, 50px) rotate(5deg); }
        }
        @keyframes blurSlide {
          from { background-position: 0 0; }
          to { background-position: 100% 0; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * 📚 KIẾN THỨC: Component nhỏ (Sub-component)
 *
 * Thay vì viết HTML game card ở 2 chỗ (reflex và conquest),
 * ta tách ra thành component riêng và truyền data qua Props.
 *
 * Props = "Properties" = tham số truyền vào component.
 * Giống như arguments của function, nhưng dùng cho UI.
 *
 * Interface định nghĩa "hình dạng" của props (TypeScript).
 */
interface GameCardProps {
  id: string;
  imageSrc: string;
  label: [string, string]; // Tuple: mảng có đúng 2 phần tử
  isSelected: boolean;
  onClick: () => void; // Function không tham số, không return gì
}

function GameCard({ id, imageSrc, label, isSelected, onClick }: GameCardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer"
    >
      {/* Card frame */}
      <div
        className="w-30 h-30 border-4 flex items-center justify-center transition-all duration-500"
        style={{
          borderColor: "#F5F5DC",
          backgroundColor: "#F5F5DC",
          /**
           * 📚 KIẾN THỨC: Template Literal trong style
           *
           * Dùng để tính toán style động dựa trên state.
           * isSelected ? value_if_true : value_if_false
           * = Ternary operator (toán tử 3 ngôi)
           */
          transform: isSelected ? "scale(1.1)" : "scale(1)",
          boxShadow: isSelected ? "0 0 20px rgba(255, 215, 0, 0.6)" : "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={label.join(" ")}
          className="w-full h-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* Label — slide down khi selected */}
      <div
        className="w-30 text-sm font-bold text-center text-[#333] overflow-hidden transition-all duration-500"
        style={{
          fontFamily: "'SVN-Determination', 'KVN', sans-serif",
          height: isSelected ? 60 : 0,
          opacity: isSelected ? 1 : 0,
          backgroundColor: "#F5F5DC",
          padding: isSelected ? "8px 10px" : "0 10px",
        }}
      >
        {label[0]}
        <br />
        {label[1]}
      </div>
    </div>
  );
}
