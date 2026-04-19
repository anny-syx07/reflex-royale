"use client";

/**
 * 📚 KIẾN THỨC: Host Game Screen
 * file: app/game/host/page.tsx ← host-reflex.html + host.js
 *
 * Đây là trang phức tạp nhất — quản lý toàn bộ game flow cho host.
 *
 * Khái niệm mới ở trang này:
 * 1. useCallback: tối ưu performance, tránh tạo function mới mỗi lần render
 * 2. useRef cho intervals: intervals/timers không được để trong state
 * 3. Socket.IO event listeners trong useEffect
 * 4. Cleanup pattern: removeAllListeners khi component unmount
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type {
  Player,
  RoundType,
  RoundData,
  RoundStartEvent,
  LeaderboardUpdateEvent,
  GameOverEvent,
  PlayerListUpdateEvent,
  ColorRoundData,
  SwipeRoundData,
  ShakeRoundData,
  DontTapRoundData,
  QuickMathRoundData,
  IconHuntRoundData,
  SoundCheckRoundData,
  FinalBlitzRoundData,
} from "@/types/game";

// Màu và tên tiếng Việt
const COLOR_NAMES: Record<string, string> = {
  RED: "ĐỎ", BLUE: "XANH", YELLOW: "VÀNG", PURPLE: "TÍM",
};
const COLOR_HEX: Record<string, string> = {
  RED: "#FF6B6B", BLUE: "#4ECDC4", YELLOW: "#FFE66D", PURPLE: "#A78BFA",
};
const DIRECTION_ARROWS: Record<string, string> = {
  UP: "⬆️", DOWN: "⬇️", LEFT: "⬅️", RIGHT: "➡️",
};
const DIRECTION_NAMES: Record<string, string> = {
  UP: "LÊN", DOWN: "XUỐNG", LEFT: "TRÁI", RIGHT: "PHẢI",
};

// Loại màn hình hiện tại
type ScreenType = "waiting" | "playing" | "gameOver";

export default function HostGamePage() {
  const router = useRouter();
  const socket = getSocket();

  // ===== STATE =====
  const [screen, setScreen] = useState<ScreenType>("waiting");
  const [roomCode, setRoomCode] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(7);
  const [timerValue, setTimerValue] = useState<number | string>("--");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState<Player[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showNextBtn, setShowNextBtn] = useState(false);
  const [currentRoundType, setCurrentRoundType] = useState<RoundType | null>(null);
  const [currentRoundData, setCurrentRoundData] = useState<RoundData | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; left: number; size: number; duration: number }[]>([]);

  /**
   * 📚 KIẾN THỨC: useRef cho Timers
   *
   * Tại sao không dùng useState cho interval ID?
   * → Nếu lưu vào state, React sẽ re-render mỗi khi interval ID thay đổi
   * → Gây ra vòng lặp vô hạn vì re-render → effect chạy lại → interval mới
   *
   * useRef giữ giá trị "bên ngoài" vòng đời render của React.
   * Thay đổi ref.current KHÔNG trigger re-render.
   */
  const globalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);

  function clearAllTimers() {
    if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    globalTimerRef.current = null;
    roundTimerRef.current = null;
  }

  function startGlobalTimer(seconds: number) {
    let timeLeft = seconds;
    setTimerValue(timeLeft);
    if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    globalTimerRef.current = setInterval(() => {
      timeLeft--;
      setTimerValue(Math.max(0, timeLeft));
      if (timeLeft <= 0) clearInterval(globalTimerRef.current!);
    }, 1000);
  }

  /**
   * 📚 KIẾN THỨC: useCallback
   *
   * useCallback = "nhớ" một function, không tạo lại trừ khi dependency thay đổi.
   *
   * Vấn đề: Nếu định nghĩa function bình thường bên trong component,
   * mỗi lần re-render → function mới được tạo → useEffect detect "dependency thay đổi"
   * → useEffect chạy lại → infinite loop.
   *
   * Giải pháp: useCallback với dependency array rỗng [] = function chỉ tạo 1 lần.
   */
  const handleRoomCreated = useCallback(({ roomCode: code }: { roomCode: string }) => {
    setRoomCode(code);
    localStorage.setItem("reflexHostRoom", code);
  }, []);

  const handlePlayerListUpdate = useCallback(({ players: list }: PlayerListUpdateEvent) => {
    setPlayers(list);
  }, []);

  const handleGameStarted = useCallback(() => {
    setScreen("playing");
    setShowLeaderboard(false);
  }, []);

  const handleRoundStart = useCallback(({ roundNumber, totalRounds: total, roundType, roundData }: RoundStartEvent) => {
    setCurrentRound(roundNumber);
    setTotalRounds(total);
    setCurrentRoundType(roundType);
    setCurrentRoundData(roundData);
    setShowLeaderboard(false);
    setShowNextBtn(false);
    clearAllTimers();

    // Duration dựa trên round type
    const durations: Partial<Record<RoundType, number>> = {
      COLOR_TAP: 5, SWIPE: 5,
    };
    const durationMs = (roundData as any).duration;
    const seconds = durationMs ? durationMs / 1000 : (durations[roundType] ?? 5);
    startGlobalTimer(seconds);
  }, []);

  const handleLeaderboardUpdate = useCallback(({ leaderboard: lb }: LeaderboardUpdateEvent) => {
    setLeaderboard(lb);
  }, []);

  const handleRoundEnd = useCallback(() => {
    clearAllTimers();
    setTimerValue("✓");
    setShowNextBtn(true);
  }, []);

  const handleGameOver = useCallback(({ finalLeaderboard: lb }: GameOverEvent) => {
    setFinalLeaderboard(lb);
    setScreen("gameOver");
    // Start confetti
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 20 + 20,
      duration: Math.random() * 3 + 2,
    }));
    setConfetti(items);
  }, []);

  const handleEnergyBarUpdate = useCallback(({ totalShakes, maxShakes }: { totalShakes: number; maxShakes: number }) => {
    // Update energy bar — dùng DOM trực tiếp để tránh re-render nặng
    const bar = document.getElementById("energyBar");
    const text = document.getElementById("energyText");
    if (bar) bar.style.width = `${Math.min(100, (totalShakes / maxShakes) * 100)}%`;
    if (text) text.textContent = `${totalShakes} / ${maxShakes}`;
  }, []);

  /**
   * 📚 KIẾN THỨC: useEffect với Socket.IO
   *
   * Pattern chuẩn để đăng ký socket events trong React:
   *
   * 1. useEffect chạy SAU khi component mount
   * 2. Đăng ký event listeners
   * 3. Return cleanup function → React gọi khi component unmount
   * 4. Cleanup: xóa listeners để tránh duplicate events
   *
   * Dependency array [handleRoomCreated, ...] → useEffect chạy lại
   * nếu bất kỳ handler nào thay đổi. Nhưng vì ta dùng useCallback,
   * các handlers không thay đổi → useEffect chỉ chạy 1 lần.
   */
  useEffect(() => {
    // Check auth
    if (sessionStorage.getItem("hostAuth") !== "true") {
      router.replace("/");
      return;
    }

    // Check reconnect
    const savedRoom = localStorage.getItem("reflexHostRoom");
    if (savedRoom) {
      socket.emit("reconnectHost", { roomCode: savedRoom });
    } else {
      socket.emit("createRoom");
    }

    // Đăng ký tất cả socket listeners
    socket.on("roomCreated", handleRoomCreated);
    socket.on("reconnectResult", ({ success, roomCode: code, players: list }: any) => {
      if (success) {
        setRoomCode(code);
        if (list) setPlayers(list);
      } else {
        localStorage.removeItem("reflexHostRoom");
        socket.emit("createRoom");
      }
    });
    socket.on("playerListUpdate", handlePlayerListUpdate);
    socket.on("gameStarted", handleGameStarted);
    socket.on("roundStart", handleRoundStart);
    socket.on("leaderboardUpdate", handleLeaderboardUpdate);
    socket.on("roundEnd", handleRoundEnd);
    socket.on("gameOver", handleGameOver);
    socket.on("energyBarUpdate", handleEnergyBarUpdate);
    socket.on("roomReset", ({ players: list }: { players: Player[] }) => {
      setPlayers(list);
      setScreen("waiting");
      setShowNextBtn(false);
      clearAllTimers();
    });

    // CLEANUP: Chạy khi component unmount
    return () => {
      socket.off("roomCreated", handleRoomCreated);
      socket.off("reconnectResult");
      socket.off("playerListUpdate", handlePlayerListUpdate);
      socket.off("gameStarted", handleGameStarted);
      socket.off("roundStart", handleRoundStart);
      socket.off("leaderboardUpdate", handleLeaderboardUpdate);
      socket.off("roundEnd", handleRoundEnd);
      socket.off("gameOver", handleGameOver);
      socket.off("energyBarUpdate", handleEnergyBarUpdate);
      socket.off("roomReset");
      clearAllTimers();
    };
  }, [
    router, socket,
    handleRoomCreated, handlePlayerListUpdate, handleGameStarted,
    handleRoundStart, handleLeaderboardUpdate, handleRoundEnd,
    handleGameOver, handleEnergyBarUpdate,
  ]);

  function handleStartGame() {
    socket.emit("startGame", { roomCode });
  }

  function handleNextRound() {
    const isLastRound = currentRound >= totalRounds;
    if (isLastRound) {
      socket.emit("nextRound", { roomCode });
      return;
    }

    setShowNextBtn(false);
    setShowLeaderboard(true);

    // Đếm ngược 5 giây rồi next round
    let countdown = 5;
    setTimerValue(countdown);
    const timer = setInterval(() => {
      countdown--;
      setTimerValue(countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        socket.emit("nextRound", { roomCode });
      }
    }, 1000);
  }

  function handleNewGame() {
    socket.emit("resetRoom", { roomCode });
  }

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-['Outfit',sans-serif]">
      {/* ===== WAITING SCREEN ===== */}
      {screen === "waiting" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
          <h1 className="text-5xl font-bold text-gradient animate-bounce-in">⚡ REFLEX ROYALE ⚡</h1>

          {/* Room Code Card */}
          <div className="glass rounded-2xl p-8 text-center w-full max-w-sm animate-pulse-slow">
            <p className="text-slate-400 text-sm mb-2">Mã Phòng</p>
            <h2 className="text-6xl font-bold tracking-widest text-white mb-4">
              {roomCode || "------"}
            </h2>
            <button
              onClick={() => setIsQrOpen(true)}
              className="flex items-center gap-2 mx-auto text-slate-300 hover:text-white text-sm border border-white/20 rounded-lg px-4 py-2 transition-colors"
            >
              📷 Hiện QR Code
            </button>
            <p className="text-slate-400 text-xs mt-3">
              Vào <strong className="text-white">reflex-royale</strong> và nhập mã trên
            </p>
          </div>

          {/* Player list */}
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4">
              🎮 Người Chơi Đang Chờ ({players.length})
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {players.map((p) => (
                /**
                 * 📚 KIẾN THỨC: key prop trong danh sách
                 *
                 * Khi render danh sách, React cần key duy nhất để
                 * biết phần tử nào thay đổi khi re-render.
                 * Key không có nghĩa gì với user, chỉ dùng nội bộ React.
                 */
                <div key={p.id} className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(p.nickname)}`}
                    alt={p.nickname}
                    className="w-12 h-12 rounded-full border-2 border-white/30"
                  />
                  <span className="text-xs text-center truncate w-full text-slate-300">{p.nickname}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartGame}
            disabled={players.length === 0}
            className="px-12 py-5 text-xl font-bold rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            BẮT ĐẦU TRÒ CHƠI
          </button>
        </div>
      )}

      {/* ===== GAME SCREEN ===== */}
      {screen === "playing" && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="glass px-4 py-2 rounded-xl text-sm font-semibold">
              Vòng {currentRound}/{totalRounds}
            </div>
            <div className="text-lg font-bold text-gradient">REFLEX ROYALE</div>
            <div className="flex items-center gap-3">
              <div className="glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <span>⏱️</span>
                <span className="font-bold text-xl">{timerValue}</span>
                {typeof timerValue === "number" && <span className="text-slate-400">s</span>}
              </div>
              {showNextBtn && (
                <button
                  onClick={handleNextRound}
                  className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-500 transition-colors"
                >
                  Vòng Tiếp →
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex gap-4 p-4">
            {/* Round Display */}
            <div className="flex-1 flex items-center justify-center">
              {currentRoundData && currentRoundType && (
                <RoundDisplay roundType={currentRoundType} roundData={currentRoundData} />
              )}
            </div>

            {/* Leaderboard sidebar */}
            {showLeaderboard && leaderboard.length > 0 && (
              <div className="w-64 glass rounded-2xl p-4">
                <h3 className="text-sm font-bold mb-3 text-center">🏆 BXH LIVE</h3>
                <div className="flex flex-col gap-2">
                  {leaderboard.slice(0, 10).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <span className={`w-6 text-center font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-slate-400"}`}>
                        #{i + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(p.nickname)}`}
                        alt=""
                        className="w-7 h-7 rounded-full border border-white/20"
                      />
                      <span className="flex-1 truncate">{p.nickname}</span>
                      <span className="font-bold text-yellow-400">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== GAME OVER SCREEN ===== */}
      {screen === "gameOver" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8 overflow-hidden relative">
          {/* Confetti */}
          {confetti.map((c) => (
            <div
              key={c.id}
              className="confetti"
              style={{ left: `${c.left}%`, fontSize: c.size, animationDuration: `${c.duration}s` }}
            >
              🎉
            </div>
          ))}

          <h1 className="text-5xl font-bold text-gradient">🎉 HOÀN THÀNH! 🎉</h1>

          <div className="glass rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-xl font-bold mb-6 text-center">🏆 BẢNG XẾP HẠNG CHUNG CUỘC</h2>
            <div className="flex flex-col gap-3">
              {finalLeaderboard.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? "bg-yellow-500/20 border border-yellow-500/50" : i === 1 ? "bg-gray-500/20" : i === 2 ? "bg-amber-700/20" : ""}`}
                >
                  <span className={`text-2xl font-bold w-8 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-slate-400"}`}>
                    #{i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatar || `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(p.nickname)}`}
                    alt=""
                    className="w-10 h-10 rounded-full border-2 border-white/20"
                  />
                  <span className="flex-1 font-semibold">{p.nickname}</span>
                  <span className="font-bold text-yellow-400">{p.score} điểm</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleNewGame}
            className="px-10 py-5 text-xl font-bold rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            TẠO TRÒ CHƠI MỚI
          </button>
        </div>
      )}

      {/* ===== QR Modal ===== */}
      {isQrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setIsQrOpen(false)}
        >
          <div
            className="glass rounded-2xl p-8 text-center max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setIsQrOpen(false)} className="absolute top-4 right-4 text-2xl">×</button>
            <p className="text-lg font-bold mb-4">QUÉT MÃ ĐỂ VÀO PHÒNG</p>
            <canvas id="qrCode" className="mx-auto" />
            <p className="mt-4 text-slate-300">MÃ: <strong className="text-white text-xl">{roomCode}</strong></p>
          </div>
        </div>
      )}

      {/* QR Code script */}
      {isQrOpen && <QRCodeGenerator roomCode={roomCode} />}
    </div>
  );
}

// ===== SUB-COMPONENTS =====

/**
 * 📚 KIẾN THỨC: Component thuần (Pure Component)
 *
 * RoundDisplay chỉ nhận props và render UI.
 * Không có state, không có side effects.
 * Đây là "presentational component" = chỉ quan tâm đến hiển thị.
 */
function RoundDisplay({ roundType, roundData }: { roundType: RoundType; roundData: RoundData }) {
  switch (roundType) {
    case "COLOR_TAP": {
      const d = roundData as ColorRoundData;
      return (
        <div
          className="w-64 h-64 rounded-3xl flex flex-col items-center justify-center text-white text-5xl font-bold shadow-2xl"
          style={{ backgroundColor: COLOR_HEX[d.color] }}
        >
          {COLOR_NAMES[d.color]}
          <div className="text-lg mt-4 opacity-80">Chạm vào màu này!</div>
        </div>
      );
    }
    case "SWIPE": {
      const d = roundData as SwipeRoundData;
      return (
        <div className="text-center">
          <div className="text-9xl mb-4">{DIRECTION_ARROWS[d.direction]}</div>
          <div className="text-3xl font-bold">Vuốt {DIRECTION_NAMES[d.direction]}!</div>
        </div>
      );
    }
    case "SHAKE": {
      const d = roundData as ShakeRoundData;
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-4xl font-bold mb-6">🥊 LẮC ĐIỆN THOẠI! 🥊</h2>
          <div className="w-full max-w-xs mx-auto bg-black/30 rounded-full h-8 overflow-hidden mb-2">
            <div id="energyBar" className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all" style={{ width: "0%" }} />
          </div>
          <div id="energyText" className="text-slate-300 mb-4">0 / 0</div>
          <div className="text-2xl font-bold">{d.duration / 1000}s</div>
        </div>
      );
    }
    case "TAP_SPAM": {
      const d = roundData as { duration: number };
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-5xl font-bold mb-4">👆 CHẠM LIÊN TỤC!</h2>
          <div className="text-8xl mb-4">GO!</div>
          <div className="text-2xl">{d.duration / 1000}s</div>
        </div>
      );
    }
    case "DONT_TAP": {
      const d = roundData as DontTapRoundData;
      return (
        <div className={`rounded-3xl p-12 text-center text-white ${d.isBomb ? "bg-red-600/80" : "bg-green-600/80"}`}>
          <div className="text-8xl mb-4">{d.isBomb ? "💣" : "✅"}</div>
          <h2 className="text-4xl font-bold">{d.isBomb ? "ĐỪNG CHẠM!" : "CHẠM NGAY!"}</h2>
          <p className="mt-3 text-lg opacity-90">{d.isBomb ? "Ai chạm sẽ bị trừ -500!" : "Nhanh tay để điểm cao!"}</p>
        </div>
      );
    }
    case "QUICK_MATH": {
      const d = roundData as QuickMathRoundData;
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-6">🧮 TÌM {d.task === "MIN" ? "SỐ NHỎ NHẤT" : "SỐ LỚN NHẤT"}!</h2>
          <div className="flex gap-4 justify-center flex-wrap">
            {d.numbers.map((n, i) => (
              <span key={i} className="w-16 h-16 bg-indigo-600/60 rounded-xl flex items-center justify-center text-2xl font-bold">
                {n}
              </span>
            ))}
          </div>
        </div>
      );
    }
    case "GYRO_BALANCE":
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-4xl font-bold mb-6">⚖️ GIỮ THĂNG BẰNG!</h2>
          <div className="w-40 h-40 rounded-full border-4 border-white/30 mx-auto flex items-center justify-center relative">
            <div className="w-4 h-4 bg-green-400 rounded-full absolute" />
            <div className="text-4xl">+</div>
          </div>
          <p className="mt-4 text-slate-300">Giữ điện thoại thật phẳng!</p>
        </div>
      );
    case "ICON_HUNT": {
      const d = roundData as IconHuntRoundData;
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-2">🔍 TÌM: <span className="text-5xl">{d.targetIcon}</span></h2>
          <div className="grid grid-cols-4 gap-2 mt-4 max-w-xs mx-auto">
            {d.gridIcons.map((icon, i) => (
              <span
                key={i}
                className={`text-3xl w-14 h-14 flex items-center justify-center rounded-xl ${i === d.targetPosition ? "bg-green-500/30 ring-2 ring-green-400" : "bg-white/10"}`}
              >
                {icon}
              </span>
            ))}
          </div>
        </div>
      );
    }
    case "SOUND_CHECK": {
      const d = roundData as SoundCheckRoundData;
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-6">🔊 PHẢN XẠ ÂM THANH!</h2>
          <audio id="hostSoundAudio" src={d.correctSound.audio} preload="auto" />
          <button
            onClick={() => {
              const audio = document.getElementById("hostSoundAudio") as HTMLAudioElement;
              audio?.play();
            }}
            className="px-8 py-4 bg-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-500"
          >
            🔊 PHÁT ÂM THANH
          </button>
          <p className="mt-4 text-slate-300">Nghe và chọn hình ảnh phù hợp!</p>
        </div>
      );
    }
    case "FINAL_BLITZ": {
      const d = roundData as FinalBlitzRoundData;
      return (
        <div className="text-center glass rounded-3xl p-10">
          <h2 className="text-4xl font-bold mb-2">⚡ VỀ ĐÍCH! ⚡</h2>
          <div className="text-yellow-400 font-bold text-xl mb-4">ĐIỂM x{d.pointMultiplier}</div>
          <p className="text-slate-300">{d.challenges.length} thử thách liên tiếp</p>
          <p className="text-slate-300">Tốc độ siêu nhanh!</p>
        </div>
      );
    }
    default:
      return <div className="text-2xl">Đang chuẩn bị...</div>;
  }
}

// QR Code generator (inject dynamic script)
function QRCodeGenerator({ roomCode }: { roomCode: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
    script.onload = () => {
      const canvas = document.getElementById("qrCode");
      const url = `${window.location.origin}/player?roomCode=${roomCode}`;
      if (canvas && (window as any).QRCode) {
        (window as any).QRCode.toCanvas(canvas, url, {
          width: 200, margin: 1, errorCorrectionLevel: "L",
          color: { dark: "#667eea", light: "#ffffff" },
        });
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [roomCode]);
  return null;
}
