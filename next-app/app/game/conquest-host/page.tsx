"use client";

/**
 * 📚 KIẾN THỨC: Conquest Host Page
 * file: app/game/conquest-host/page.tsx ← conquest-host.html + conquest-host.js
 *
 * Khái niệm mới ở trang này:
 *
 * 1. useRef cho DOM element (thay vì document.getElementById)
 *    - React không nên truy cập DOM trực tiếp
 *    - Dùng ref để "chỉ vào" DOM element một cách React-safe
 *
 * 2. Tại sao ConquestGrid/Renderer nằm trong useRef, không trong useState?
 *    - Renderer dùng DOM API (innerHTML, querySelector)
 *    - Nếu lưu vào state → React re-render → DOM bị replace → Renderer mất track
 *    - useRef giữ reference ổn định xuyên suốt vòng đời component
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { ConquestGrid, ConquestRenderer } from "@/lib/conquest-engine";

type ConquestScreen = "setup" | "playing" | "gameOver";

interface ConquestPlayer {
  id: string;
  nickname: string;
  avatar?: string;
  territory?: number;
}

export default function ConquestHostPage() {
  const router = useRouter();
  const socket = getSocket();

  // ===== STATE =====
  const [screen, setScreen] = useState<ConquestScreen>("setup");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<ConquestPlayer[]>([]);
  const [gameStatus, setGameStatus] = useState("Waiting for players...");
  const [roundInfo, setRoundInfo] = useState("Round 1/12");
  const [timer, setTimer] = useState<number | string>(5);
  const [isTimerWarning, setIsTimerWarning] = useState(false);
  const [showNextBtn, setShowNextBtn] = useState(false);
  const [showResetBtn, setShowResetBtn] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ConquestPlayer[]>([]);

  /**
   * 📚 KIẾN THỨC: useRef cho DOM Container
   *
   * gridContainerRef.current = reference tới <div id="gridContainer">
   *
   * Trong code cũ:
   *   const container = document.getElementById('gridContainer');
   *
   * Trong React:
   *   const gridContainerRef = useRef<HTMLDivElement>(null);
   *   <div ref={gridContainerRef} />
   *   → gridContainerRef.current = DOM element đó
   *
   * Tại sao an toàn hơn getElementById?
   * → document.getElementById tìm trên TOÀN BỘ document
   * → useRef chỉ chỉ vào element đúng của component này
   * → Tránh conflict nếu render nhiều instance cùng lúc
   */
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<ConquestGrid | null>(null);
  const rendererRef = useRef<ConquestRenderer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function initGrid() {
    if (!gridContainerRef.current) return;
    gridRef.current = new ConquestGrid(10);
    gridRef.current.initializeSpecialCells(8);
    rendererRef.current = new ConquestRenderer(gridContainerRef.current, gridRef.current, {
      large: true,
      clickable: false,
    });
    rendererRef.current.render();
  }

  function startTimer(durationMs: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    let timeLeft = Math.floor(durationMs / 1000);
    setTimer(timeLeft);
    setIsTimerWarning(false);

    timerRef.current = setInterval(() => {
      timeLeft--;
      setTimer(Math.max(0, timeLeft));
      setIsTimerWarning(timeLeft <= 3);
      if (timeLeft <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 1000);
  }

  // ===== SOCKET EVENTS =====
  useEffect(() => {
    if (sessionStorage.getItem("hostAuth") !== "true") {
      router.replace("/");
      return;
    }

    // Check reconnect
    const saved = localStorage.getItem("conquestHostRoom");
    if (saved) {
      socket.emit("reconnectHost", { roomCode: saved });
    }

    socket.on("conquestRoomCreated", ({ roomCode: code }: { roomCode: string }) => {
      setRoomCode(code);
      localStorage.setItem("conquestHostRoom", code);
      setScreen("playing");
      initGrid();
    });

    socket.on("reconnectResult", ({ success, roomCode: code, gameState: state, players: list, gameMode }: any) => {
      if (success && gameMode === "CONQUEST") {
        setRoomCode(code);
        setScreen("playing");
        if (list) setPlayers(list);
        initGrid();
      } else if (!success) {
        localStorage.removeItem("conquestHostRoom");
      }
    });

    socket.on("conquestPlayerListUpdate", ({ players: list }: { players: ConquestPlayer[] }) => {
      setPlayers(list);
      setLeaderboard([...list].sort((a, b) => (b.territory ?? 0) - (a.territory ?? 0)));
    });

    socket.on("conquestGameStarted", () => {
      setGameStatus("Trò chơi đang bắt đầu...");
    });

    socket.on("conquestRoundStart", (data: any) => {
      setGameStatus(`Vòng ${data.roundNumber}/${data.maxRounds}`);
      setRoundInfo(`Round ${data.roundNumber}/${data.maxRounds}`);
      setShowNextBtn(false);
      startTimer(data.duration);
    });

    socket.on("conquestMapUpdate", (data: any) => {
      if (rendererRef.current && gridRef.current) {
        if (data.grid) {
          for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 10; y++) {
              gridRef.current.setCell(x, y, data.grid[x][y]);
            }
          }
        }
        rendererRef.current.render();
      }
    });

    socket.on("conquestRoundEnd", (data: any) => {
      setGameStatus("Vòng kết thúc!");
      setShowNextBtn(true);
      if (data?.leaderboard) {
        setLeaderboard([...data.leaderboard].sort((a: ConquestPlayer, b: ConquestPlayer) => (b.territory ?? 0) - (a.territory ?? 0)));
      }
    });

    socket.on("conquestGameOver", (data: any) => {
      setGameStatus("🎉 Trò Chơi Kết Thúc!");
      setShowNextBtn(false);
      setShowResetBtn(true);
      if (data?.finalLeaderboard) {
        setLeaderboard([...data.finalLeaderboard].sort((a: ConquestPlayer, b: ConquestPlayer) => (b.territory ?? 0) - (a.territory ?? 0)));
      }
      setScreen("gameOver");
    });

    socket.on("conquestRoomReset", ({ players: list }: { players: ConquestPlayer[] }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameStatus("Waiting for players...");
      setRoundInfo("Round 1/12");
      setTimer(5);
      setIsTimerWarning(false);
      setShowNextBtn(false);
      setShowResetBtn(false);
      setPlayers(list);
      setLeaderboard([...list].sort((a, b) => (b.territory ?? 0) - (a.territory ?? 0)));
      initGrid();
    });

    return () => {
      socket.off("conquestRoomCreated");
      socket.off("reconnectResult");
      socket.off("conquestPlayerListUpdate");
      socket.off("conquestGameStarted");
      socket.off("conquestRoundStart");
      socket.off("conquestMapUpdate");
      socket.off("conquestRoundEnd");
      socket.off("conquestGameOver");
      socket.off("conquestRoomReset");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, router]);

  // Grid phải init sau khi div mount (khi screen = 'playing')
  useEffect(() => {
    if (screen === "playing" && gridContainerRef.current && !rendererRef.current) {
      initGrid();
    }
  }, [screen]);

  // ===== ACTIONS =====
  function handleCreateRoom() {
    socket.emit("createConquestRoom");
  }

  function handleStartGame() {
    socket.emit("startConquestGame", { roomCode });
  }

  function handleNextRound() {
    socket.emit("conquestNextRound", { roomCode });
    setShowNextBtn(false);
  }

  function handleResetRoom() {
    socket.emit("resetConquestRoom", { roomCode });
    setScreen("playing");
  }

  // ===== RENDER =====
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* ===== SETUP SCREEN ===== */}
      {screen === "setup" && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-8xl">🏛️</div>
          <h1 className="text-5xl font-bold text-center">Đại Chiến Giảng Đường</h1>
          <p className="text-white/70 text-lg text-center max-w-md">
            Chiến lược lãnh thổ real-time cho cả lớp. Ai chiếm nhiều ô nhất sẽ thắng!
          </p>
          <button
            onClick={handleCreateRoom}
            className="px-10 py-5 bg-white text-purple-700 font-bold text-xl rounded-2xl shadow-2xl hover:-translate-y-1 transition-all duration-300"
          >
            Tạo Phòng Mới 🚀
          </button>
        </div>
      )}

      {/* ===== PLAYING SCREEN ===== */}
      {(screen === "playing" || screen === "gameOver") && (
        <div className="flex min-h-screen gap-4 p-4">
          {/* Main Area */}
          <div className="flex-[2] flex flex-col gap-4">
            {/* Header */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center">
              <div className="text-3xl font-bold">🏛️ ĐẠI CHIẾN GIẢNG ĐƯỜNG</div>
              <div className="text-white/70 mt-1">{gameStatus}</div>
            </div>

            {/* Round + Timer */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between">
              <div className="text-lg font-semibold">{roundInfo}</div>
              <div
                className={`text-5xl font-bold transition-colors ${isTimerWarning ? "text-red-400 animate-pulse" : "text-white"}`}
              >
                {timer}
              </div>
              <div className="flex gap-3">
                {!showNextBtn && !showResetBtn && players.length > 0 && (
                  <button
                    onClick={handleStartGame}
                    className="px-5 py-2 bg-white text-purple-700 font-bold rounded-xl hover:-translate-y-1 transition-all"
                  >
                    Bắt Đầu
                  </button>
                )}
                {showNextBtn && (
                  <button
                    onClick={handleNextRound}
                    className="px-5 py-2 bg-yellow-400 text-black font-bold rounded-xl hover:-translate-y-1 transition-all"
                  >
                    Vòng Tiếp →
                  </button>
                )}
                {showResetBtn && (
                  <button
                    onClick={handleResetRoom}
                    className="px-5 py-2 bg-white text-purple-700 font-bold rounded-xl hover:-translate-y-1 transition-all"
                  >
                    🔄 Chơi Lại
                  </button>
                )}
              </div>
            </div>

            {/* Grid Container */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex-1 flex items-center justify-center">
              {/**
               * 📚 KIẾN THỨC: ref trên JSX element
               *
               * <div ref={gridContainerRef} />
               * →sau khi component mount, gridContainerRef.current = div này
               * → ConquestRenderer sẽ inject grid vào div này bằng DOM API
               *
               * Đây là "escape hatch" của React: khi cần thao tác DOM trực tiếp.
               */}
              <div ref={gridContainerRef} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-64 flex flex-col gap-4">
            {/* Room Code */}
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))" }}
            >
              <div className="text-sm text-white/70 mb-1">Mã Phòng</div>
              <div className="text-5xl font-bold tracking-widest">{roomCode || "------"}</div>
              <button
                onClick={() => setIsQrOpen(true)}
                className="mt-3 text-xs text-white/70 hover:text-white flex items-center gap-1 mx-auto"
              >
                📷 Hiện QR
              </button>
              <div className="text-xs text-white/60 mt-1">Nhập mã hoặc quét QR</div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex-1">
              <div className="text-sm font-bold mb-3 text-center">🏆 TOP 10</div>
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px]">
                {leaderboard.slice(0, 10).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-6 font-bold text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-white/50"}`}>
                      #{i + 1}
                    </span>
                    <span className="flex-1 truncate">{p.nickname}</span>
                    <span className="text-yellow-300 font-bold">{p.territory ?? 0}</span>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <p className="text-white/50 text-xs text-center">Chưa có ai...</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="flex justify-around text-center">
                <div>
                  <div className="text-xs text-white/60">Người chơi</div>
                  <div className="text-2xl font-bold">{players.length}</div>
                </div>
                <div>
                  <div className="text-xs text-white/60">Cells chiếm</div>
                  <div className="text-2xl font-bold">
                    {leaderboard.reduce((sum, p) => sum + (p.territory ?? 0), 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {isQrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setIsQrOpen(false)}
        >
          <div
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 text-center border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold mb-4">QUÉT MÃ ĐỂ VÀO PHÒNG</p>
            <canvas id="conquestQrCode" className="mx-auto" />
            <p className="mt-3 text-white/70 text-sm">MÃ: <strong className="text-white text-xl">{roomCode}</strong></p>
          </div>
        </div>
      )}

      {/* QR generator */}
      {isQrOpen && <ConquestQRCode roomCode={roomCode} />}
    </div>
  );
}

function ConquestQRCode({ roomCode }: { roomCode: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
    script.onload = () => {
      const canvas = document.getElementById("conquestQrCode");
      const url = `${window.location.origin}/player?roomCode=${roomCode}`;
      if (canvas && (window as any).QRCode) {
        (window as any).QRCode.toCanvas(canvas, url, {
          width: 180, margin: 1,
          color: { dark: "#667eea", light: "#ffffff" },
        });
      }
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch { } };
  }, [roomCode]);
  return null;
}
