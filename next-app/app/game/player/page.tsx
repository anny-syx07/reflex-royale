"use client";

/**
 * 📚 KIẾN THỨC: Player Game Screen
 * file: app/game/player/page.tsx ← player-reflex.html + player.js
 *
 * Đây là màn hình người chơi — mobile-first, xử lý nhiều loại input:
 * touch, shake, gyro, swipe, tap, audio.
 *
 * Khái niệm mới:
 * 1. useReducer: quản lý state phức tạp (thay cho nhiều useState)
 * 2. Suspense + useSearchParams để đọc URL params
 * 3. Device API: DeviceMotionEvent, DeviceOrientationEvent
 * 4. TypeScript type narrowing với switch
 */

import { useEffect, useRef, useReducer, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { RoundType, RoundData, BlitzChallenge } from "@/types/game";

// ===== STATE MANAGEMENT với useReducer =====
/**
 * 📚 KIẾN THỨC: useReducer vs useState
 *
 * useState tốt cho state đơn giản (1-2 giá trị).
 * useReducer tốt cho state phức tạp có nhiều actions liên quan nhau.
 *
 * Cú pháp:
 *   const [state, dispatch] = useReducer(reducer, initialState);
 *   dispatch({ type: 'ACTION_NAME', payload: data });  → gọi reducer
 *   reducer(state, action) → trả về state mới
 *
 * Lợi ích: Logic state tập trung 1 chỗ, dễ debug.
 */

type Screen = "join" | "waiting" | "playing" | "gameOver";

type GameStateType = {
  screen: Screen;
  roomCode: string;
  playerId: string;
  score: number;
  roundType: RoundType | null;
  roundData: RoundData | null;
  feedback: { text: string; isCorrect: boolean } | null;
  gameOverData: { rank: number; total: number; score: number } | null;
  error: string;
};

type Action =
  | { type: "JOINED"; roomCode: string; playerId: string }
  | { type: "GAME_STARTED" }
  | { type: "ROUND_START"; roundType: RoundType; roundData: RoundData }
  | { type: "ROUND_END" }
  | { type: "RESPONSE_RESULT"; correct: boolean; points: number; totalScore: number }
  | { type: "GAME_OVER"; rank: number; total: number; score: number }
  | { type: "ROOM_RESET" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_FEEDBACK" };

function reducer(state: GameStateType, action: Action): GameStateType {
  switch (action.type) {
    case "JOINED":
      return { ...state, screen: "waiting", roomCode: action.roomCode, playerId: action.playerId };
    case "GAME_STARTED":
      return { ...state, screen: "playing" };
    case "ROUND_START":
      return { ...state, roundType: action.roundType, roundData: action.roundData, feedback: null };
    case "ROUND_END":
      return { ...state, roundType: null };
    case "RESPONSE_RESULT":
      return {
        ...state,
        score: action.totalScore,
        feedback: {
          text: action.correct ? `+${action.points} ✓` : `${action.points} ✗`,
          isCorrect: action.correct,
        },
      };
    case "GAME_OVER":
      return {
        ...state,
        screen: "gameOver",
        gameOverData: { rank: action.rank, total: action.total, score: action.score },
      };
    case "ROOM_RESET":
      return { ...state, screen: "waiting", score: 0, roundType: null };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "CLEAR_FEEDBACK":
      return { ...state, feedback: null };
    default:
      return state;
  }
}

const initialState: GameStateType = {
  screen: "join",
  roomCode: "",
  playerId: "",
  score: 0,
  roundType: null,
  roundData: null,
  feedback: null,
  gameOverData: null,
  error: "",
};

// ===== MAIN COMPONENT =====
function PlayerGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);
  const socket = getSocket();

  // Refs cho sensors
  const shakeCountRef = useRef(0);
  const tapCountRef = useRef(0);
  const lastShakeTimeRef = useRef(0);
  const shakeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const balanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const blitzTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dontTapTouchedRef = useRef(false);
  const mathAnsweredRef = useRef(false);
  const roundStartTimeRef = useRef(0);

  // Auto-join nếu có params từ URL
  useEffect(() => {
    const roomCode = searchParams.get("roomCode");
    const nickname = searchParams.get("nickname");
    const avatar = searchParams.get("avatar");

    if (roomCode && nickname) {
      const socket = getSocket();
      socket.emit("joinRoom", { roomCode, nickname, avatar });
    }
  }, [searchParams]);

  // Hàm gửi response
  const sendResponse = useCallback((response: string) => {
    const timestamp = Date.now();
    socket.emit("playerResponse", {
      roomCode: state.roomCode,
      response,
      timestamp,
    });
  }, [socket, state.roomCode]);

  // Cleanup tất cả sensors
  const cleanupSensors = useCallback(() => {
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);
    if (blitzTimerRef.current) clearInterval(blitzTimerRef.current);
    shakeIntervalRef.current = null;
    balanceIntervalRef.current = null;
    blitzTimerRef.current = null;
    shakeCountRef.current = 0;
    tapCountRef.current = 0;
    dontTapTouchedRef.current = false;
    mathAnsweredRef.current = false;
  }, []);

  // Socket event listeners
  useEffect(() => {
    socket.on("joinedRoom", ({ roomCode: code, playerId: id }: any) => {
      dispatch({ type: "JOINED", roomCode: code, playerId: id });
    });

    socket.on("error", ({ message }: { message: string }) => {
      dispatch({ type: "SET_ERROR", error: message });
    });

    socket.on("gameStarted", () => {
      dispatch({ type: "GAME_STARTED" });
    });

    socket.on("roundStart", ({ roundType, roundData, startTime }: any) => {
      cleanupSensors();
      roundStartTimeRef.current = startTime;
      dispatch({ type: "ROUND_START", roundType, roundData });
    });

    socket.on("roundEnd", () => {
      cleanupSensors();
      dispatch({ type: "ROUND_END" });
    });

    socket.on("responseResult", ({ correct, points, totalScore }: any) => {
      dispatch({ type: "RESPONSE_RESULT", correct, points, totalScore });
      if (navigator.vibrate) navigator.vibrate(correct ? [50] : [50, 50, 50]);
      // Ẩn feedback sau 1.5 giây
      setTimeout(() => dispatch({ type: "CLEAR_FEEDBACK" }), 1500);
    });

    socket.on("gameOver", ({ finalLeaderboard }: any) => {
      const playerId = state.playerId;
      const rank = finalLeaderboard.findIndex((p: any) => p.id === playerId) + 1;
      dispatch({
        type: "GAME_OVER",
        rank,
        total: finalLeaderboard.length,
        score: state.score,
      });
    });

    socket.on("roomReset", () => dispatch({ type: "ROOM_RESET" }));

    return () => {
      socket.off("joinedRoom");
      socket.off("error");
      socket.off("gameStarted");
      socket.off("roundStart");
      socket.off("roundEnd");
      socket.off("responseResult");
      socket.off("gameOver");
      socket.off("roomReset");
      cleanupSensors();
    };
  }, [socket, cleanupSensors, state.playerId, state.score]);

  // ===== GAME AREA RENDERERS =====

  function renderGameArea() {
    if (!state.roundType || !state.roundData) return (
      <div className="flex-1 flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );

    switch (state.roundType) {
      case "COLOR_TAP":
        return <ColorTapArea onResponse={sendResponse} />;
      case "SWIPE":
        return <SwipeArea onResponse={sendResponse} />;
      case "SHAKE":
        return <ShakeArea roomCode={state.roomCode} socket={socket} shakeCountRef={shakeCountRef} lastShakeTimeRef={lastShakeTimeRef} shakeIntervalRef={shakeIntervalRef} />;
      case "TAP_SPAM":
        return <TapSpamArea roomCode={state.roomCode} socket={socket} tapCountRef={tapCountRef} tapIntervalRef={shakeIntervalRef} />;
      case "DONT_TAP":
        return <DontTapArea roundData={state.roundData as any} onResponse={sendResponse} dontTapTouchedRef={dontTapTouchedRef} />;
      case "QUICK_MATH":
        return <QuickMathArea roundData={state.roundData as any} onResponse={sendResponse} mathAnsweredRef={mathAnsweredRef} />;
      case "GYRO_BALANCE":
        return <GyroBalanceArea roundData={state.roundData as any} roomCode={state.roomCode} socket={socket} balanceIntervalRef={balanceIntervalRef} />;
      case "ICON_HUNT":
        return <IconHuntArea roundData={state.roundData as any} onResponse={sendResponse} />;
      case "SOUND_CHECK":
        return <SoundCheckArea roundData={state.roundData as any} onResponse={sendResponse} />;
      case "FINAL_BLITZ":
        return <FinalBlitzArea roundData={state.roundData as any} onResponse={sendResponse} blitzTimerRef={blitzTimerRef} />;
      default:
        return null;
    }
  }

  // ===== RENDER CHÍNH =====
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col" style={{ fontFamily: "'Outfit', sans-serif", touchAction: "manipulation" }}>

      {/* JOIN SCREEN — hiện khi chưa vào phòng */}
      {state.screen === "join" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="glass rounded-2xl p-8 w-full max-w-sm text-center">
            <h1 className="text-3xl font-bold text-gradient mb-2">⚡ REFLEX ROYALE ⚡</h1>
            <p className="text-slate-400 mb-6 text-sm">Đang kết nối...</p>
            {state.error && <p className="text-red-400 text-sm mb-4">{state.error}</p>}
            <div className="loading-spinner mx-auto" />
          </div>
        </div>
      )}

      {/* WAITING SCREEN */}
      {state.screen === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <h2 className="text-4xl font-bold text-gradient">Đã Vào Phòng!</h2>
          <p className="text-slate-300 text-lg">Đợi MC bắt đầu trò chơi...</p>
          <div className="loading-spinner" />
        </div>
      )}

      {/* GAME SCREEN */}
      {state.screen === "playing" && (
        <div className="flex-1 flex flex-col">
          {/* Score header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-slate-400 text-sm">Điểm của bạn</span>
            <span className="text-3xl font-bold text-yellow-400">{state.score}</span>
          </div>

          {/* Game area */}
          <div className="flex-1 relative">
            {renderGameArea()}

            {/* Feedback overlay */}
            {state.feedback && (
              <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                <div className={`text-6xl font-bold animate-bounce-in px-8 py-4 rounded-2xl ${state.feedback.isCorrect ? "text-green-400 bg-green-400/20" : "text-red-400 bg-red-400/20"}`}>
                  {state.feedback.text}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {state.screen === "gameOver" && state.gameOverData && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 text-center">
          <h1 className="text-4xl font-bold text-gradient">🎉 HOÀN THÀNH! 🎉</h1>
          <div className="glass rounded-2xl p-8 w-full max-w-sm">
            <div className="text-6xl font-bold text-yellow-400 mb-2">
              #{state.gameOverData.rank}
            </div>
            <div className="text-slate-300 mb-4">/ {state.gameOverData.total} người chơi</div>
            <div className="text-2xl">
              Tổng điểm: <strong className="text-yellow-400">{state.gameOverData.score}</strong>
            </div>
          </div>
          <button
            onClick={() => {
              socket.removeAllListeners();
              router.push("/player");
            }}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl font-bold text-lg hover:-translate-y-1 transition-all"
          >
            🎮 CHƠI LẠI
          </button>
        </div>
      )}
    </div>
  );
}

// ===== GAME AREA COMPONENTS =====

function ColorTapArea({ onResponse }: { onResponse: (r: string) => void }) {
  const colors = [
    { id: "RED", label: "ĐỎ", bg: "bg-red-500 active:bg-red-600" },
    { id: "BLUE", label: "XANH", bg: "bg-teal-400 active:bg-teal-500" },
    { id: "YELLOW", label: "VÀNG", bg: "bg-yellow-400 active:bg-yellow-500" },
    { id: "PURPLE", label: "TÍM", bg: "bg-purple-500 active:bg-purple-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-full">
      {colors.map((c) => (
        <button
          key={c.id}
          onClick={() => onResponse(c.id)}
          className={`${c.bg} rounded-2xl text-white text-3xl font-bold active:scale-95 transition-transform`}
          style={{ minHeight: 120, fontFamily: "'Press Start 2P', cursive", fontSize: 20 }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function SwipeArea({ onResponse }: { onResponse: (r: string) => void }) {
  const touchStart = useRef({ x: 0, y: 0 });
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center select-none"
      style={{ minHeight: "60vh" }}
      onTouchStart={(e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return;
        const dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "RIGHT" : "LEFT")
          : (dy > 0 ? "DOWN" : "UP");
        onResponse(dir);
      }}
    >
      <div className="text-8xl mb-4 select-none">👆</div>
      <h2 className="text-2xl font-bold">VUỐT THEO MŨI TÊN!</h2>
      <p className="text-slate-400 mt-2 text-sm">Vuốt màn hình theo đúng hướng</p>
    </div>
  );
}

function ShakeArea({ roomCode, socket, shakeCountRef, lastShakeTimeRef, shakeIntervalRef }: any) {
  const countEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleShake = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const now = Date.now();
      if (now - lastShakeTimeRef.current < 100) return;
      if (Math.abs(acc.x ?? 0) > 15 || Math.abs(acc.y ?? 0) > 15 || Math.abs(acc.z ?? 0) > 15) {
        shakeCountRef.current++;
        lastShakeTimeRef.current = now;
        if (countEl.current) countEl.current.textContent = String(shakeCountRef.current);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    };

    /**
     * 📚 KIẾN THỨC: iOS Permission Request
     *
     * iOS 13+ yêu cầu user cho phép trước khi dùng DeviceMotionEvent.
     * requestPermission() trả về Promise<'granted' | 'denied'>.
     *
     * Android không cần permission — addEventListener trực tiếp.
     */
    if (typeof DeviceMotionEvent !== "undefined" && (DeviceMotionEvent as any).requestPermission) {
      (DeviceMotionEvent as any).requestPermission().then((state: string) => {
        if (state === "granted") window.addEventListener("devicemotion", handleShake);
      });
    } else {
      window.addEventListener("devicemotion", handleShake);
    }

    shakeIntervalRef.current = setInterval(() => {
      socket.emit("shakeUpdate", { roomCode, shakeCount: shakeCountRef.current });
    }, 200);

    return () => {
      window.removeEventListener("devicemotion", handleShake);
    };
  }, [roomCode, socket, shakeCountRef, lastShakeTimeRef, shakeIntervalRef]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
      <div className="text-6xl animate-bounce">📱</div>
      <h2 className="text-3xl font-bold">LẮC ĐIỆN THOẠI!</h2>
      <div ref={countEl} className="text-8xl font-bold text-yellow-400">0</div>
      <p className="text-slate-400">lần lắc</p>
    </div>
  );
}

function TapSpamArea({ roomCode, socket, tapCountRef, tapIntervalRef }: any) {
  const countEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tapIntervalRef.current = setInterval(() => {
      socket.emit("tapUpdate", { roomCode, tapCount: tapCountRef.current });
    }, 200);
    return () => {};
  }, [roomCode, socket, tapCountRef, tapIntervalRef]);

  const handleTap = () => {
    tapCountRef.current++;
    if (countEl.current) countEl.current.textContent = String(tapCountRef.current);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <h2 className="text-3xl font-bold">CHẠM LIÊN TỤC!</h2>
      <button
        onPointerDown={handleTap}
        className="w-48 h-48 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-4xl font-bold active:scale-95 transition-transform shadow-2xl"
      >
        GO!
      </button>
      <div ref={countEl} className="text-6xl font-bold text-yellow-400">0</div>
      <p className="text-slate-400">lần chạm</p>
    </div>
  );
}

function DontTapArea({ roundData, onResponse, dontTapTouchedRef }: any) {
  const handleTap = () => {
    if (dontTapTouchedRef.current) return;
    dontTapTouchedRef.current = true;
    if (navigator.vibrate) navigator.vibrate(roundData.isBomb ? [100, 50, 100] : [50]);
    onResponse("TAPPED");
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dontTapTouchedRef.current) onResponse("HELD");
    }, roundData.duration - 100);
    return () => clearTimeout(timer);
  }, [roundData.duration, onResponse, dontTapTouchedRef]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <button
        onPointerDown={handleTap}
        className={`w-64 h-64 rounded-3xl flex flex-col items-center justify-center text-white transition-all active:scale-95 ${roundData.isBomb ? "bg-gradient-to-br from-red-500 to-red-700" : "bg-gradient-to-br from-green-500 to-green-700"}`}
      >
        <div className="text-8xl mb-4">{roundData.isBomb ? "💣" : "✅"}</div>
        <h2 className="text-2xl font-bold">{roundData.isBomb ? "ĐỪNG CHẠM!" : "CHẠM NGAY!"}</h2>
        <p className="text-sm mt-2 opacity-80">{roundData.isBomb ? "Giữ yên tay!" : "Nhanh tay!"}</p>
      </button>
    </div>
  );
}

function QuickMathArea({ roundData, onResponse, mathAnsweredRef }: any) {
  const shuffled = [...roundData.numbers].sort(() => Math.random() - 0.5);
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
      <h2 className="text-2xl font-bold">Chọn số {roundData.task === "MIN" ? "NHỎ NHẤT" : "LỚN NHẤT"}</h2>
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {shuffled.map((n: number, i: number) => (
          <button
            key={i}
            onClick={() => {
              if (mathAnsweredRef.current) return;
              mathAnsweredRef.current = true;
              onResponse(n.toString());
            }}
            className="h-24 rounded-2xl bg-indigo-600 text-white text-4xl font-bold active:scale-95 transition-transform"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function GyroBalanceArea({ roundData, roomCode, socket, balanceIntervalRef }: any) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isBalancedRef = useRef(false);
  const balanceScoreRef = useRef(0);
  const scoreEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const tolerance = 5;
      const balanced = Math.abs(beta) <= tolerance && Math.abs(gamma) <= tolerance;
      isBalancedRef.current = balanced;
      if (indicatorRef.current) {
        const x = (gamma / 90) * 40;
        const y = (beta / 30) * 40;
        indicatorRef.current.style.transform = `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))`;
        indicatorRef.current.style.color = balanced ? "#4ade80" : "#f87171";
      }
    };

    if ((DeviceOrientationEvent as any).requestPermission) {
      (DeviceOrientationEvent as any).requestPermission().then((s: string) => {
        if (s === "granted") window.addEventListener("deviceorientation", handleOrientation);
      });
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    balanceIntervalRef.current = setInterval(() => {
      if (isBalancedRef.current) {
        balanceScoreRef.current += 10;
        if (scoreEl.current) scoreEl.current.textContent = `${balanceScoreRef.current} điểm`;
      }
      socket.emit("balanceUpdate", { roomCode, balanceScore: balanceScoreRef.current, isBalanced: isBalancedRef.current });
    }, 100);

    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [roomCode, socket, balanceIntervalRef]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
      <h2 className="text-3xl font-bold">GIỮ THĂNG BẰNG!</h2>
      <div className="relative w-48 h-48 rounded-full border-4 border-white/30 bg-white/5">
        <div className="absolute w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div
          ref={indicatorRef}
          className="absolute text-4xl font-bold top-1/2 left-1/2 transition-transform"
          style={{ transform: "translate(-50%, -50%)", color: "#f87171" }}
        >
          +
        </div>
      </div>
      <div ref={scoreEl} className="text-4xl font-bold text-yellow-400">0 điểm</div>
    </div>
  );
}

function IconHuntArea({ roundData, onResponse }: any) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
      <h2 className="text-2xl font-bold">TÌM: <span className="text-5xl">{roundData.targetIcon}</span></h2>
      <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
        {roundData.gridIcons.map((icon: string, i: number) => (
          <button
            key={i}
            onClick={() => onResponse(i.toString())}
            className="w-16 h-16 rounded-xl bg-white/10 text-3xl flex items-center justify-center active:scale-90 transition-transform hover:bg-white/20"
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function SoundCheckArea({ roundData, onResponse }: any) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
      <h2 className="text-2xl font-bold">🔊 NGHE VÀ CHỌN!</h2>
      <audio id="playerSoundAudio" src={roundData.correctSound.audio} preload="auto" />
      <button
        onClick={() => (document.getElementById("playerSoundAudio") as HTMLAudioElement)?.play()}
        className="px-8 py-4 bg-indigo-600 rounded-2xl font-bold text-lg"
      >
        🔊 PHÁT ÂM THANH
      </button>
      <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
        {roundData.allSounds.map((s: any) => (
          <button
            key={s.id}
            onClick={() => onResponse(s.id)}
            className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl active:scale-95 transition-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover" />
            <span className="font-semibold">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FinalBlitzArea({ roundData, onResponse, blitzTimerRef }: any) {
  const [challengeIdx, setChallengeIdx] = useReducer((s: number) => Math.min(s + 1, roundData.challenges.length - 1), 0);

  useEffect(() => {
    blitzTimerRef.current = setInterval(() => {
      setChallengeIdx();
    }, roundData.challengeDuration);
    return () => { if (blitzTimerRef.current) clearInterval(blitzTimerRef.current); };
  }, [roundData.challengeDuration, blitzTimerRef]);

  const challenge: BlitzChallenge = roundData.challenges[challengeIdx];
  if (!challenge) return null;

  const sendBlitz = (answer: string) => {
    onResponse(JSON.stringify({ challengeIndex: challengeIdx, answer }));
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-white/10">
        <span className="font-bold text-lg">⚡ VỀ ĐÍCH!</span>
        <span className="text-slate-400 text-sm">{challengeIdx + 1}/{roundData.challenges.length} · x{roundData.pointMultiplier}</span>
      </div>

      {/* Challenge */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {challenge.type === "COLOR" && (
          <div className="grid grid-cols-2 gap-3 w-full">
            {[
              { id: "RED", label: "ĐỎ", bg: "#FF6B6B" },
              { id: "BLUE", label: "XANH", bg: "#4ECDC4" },
              { id: "YELLOW", label: "VÀNG", bg: "#FFE66D" },
              { id: "PURPLE", label: "TÍM", bg: "#A78BFA" },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => sendBlitz(c.id)}
                className="h-24 rounded-2xl text-white font-bold text-xl active:scale-95 transition-transform"
                style={{ backgroundColor: c.bg, color: c.id === "YELLOW" ? "#333" : "white" }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {challenge.type === "SWIPE" && (
          <div className="text-center text-8xl">
            {{ UP: "⬆️", DOWN: "⬇️", LEFT: "⬅️", RIGHT: "➡️" }[challenge.direction!]}
            <p className="text-xl mt-4">VUỐT ngay!</p>
          </div>
        )}
        {challenge.type === "TAP" && (
          <button
            onClick={() => sendBlitz("TAP")}
            className="w-48 h-48 rounded-full bg-purple-600 text-white text-4xl font-bold active:scale-95"
          >
            CHẠM!
          </button>
        )}
        {challenge.type === "MATH" && (
          <div className="grid grid-cols-2 gap-3 w-full">
            <p className="col-span-2 text-center font-bold text-lg mb-2">
              {challenge.task === "MIN" ? "SỐ NHỎ NHẤT" : "SỐ LỚN NHẤT"}
            </p>
            {(challenge.numbers ?? []).map((n: number, i: number) => (
              <button key={i} onClick={() => sendBlitz(n.toString())}
                className="h-20 rounded-2xl bg-indigo-600 text-white text-3xl font-bold active:scale-95">
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Suspense wrapper
export default function PlayerGamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    }>
      <PlayerGameContent />
    </Suspense>
  );
}
