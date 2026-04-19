"use client";

/**
 * 📚 KIẾN THỨC: Conquest Player Page
 * file: app/game/conquest-player/page.tsx ← conquest-player.html (inline script)
 *
 * Trang này:
 * - Hiển thị grid 10x10 cho người chơi tương tác
 * - Người chơi click vào ô trống để "claim" territory
 * - Mỗi vòng có giới hạn AP (Action Points)
 * - Khi hết thời gian → tự động submit actions
 *
 * Khái niệm quan trọng:
 * 1. useRef cho mutable non-render data (pendingActions, hasSubmitted)
 * 2. useRef cho DOM container của grid
 * 3. Kết hợp React state (UI) + DOM manipulation (grid cells)
 */

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { ConquestGrid, ConquestRenderer } from "@/lib/conquest-engine";
import type { GridState, PendingAction } from "@/lib/conquest-engine";

function ConquestPlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = getSocket();

  // ===== STATE (trigger re-render) =====
  type Screen = "waiting" | "playing" | "gameOver";
  const [screen, setScreen] = useState<Screen>("waiting");
  const [roundDisplay, setRoundDisplay] = useState("Round 1/12");
  const [timer, setTimer] = useState(12);
  const [isTimerWarning, setIsTimerWarning] = useState(false);
  const [territory, setTerritory] = useState(0);
  const [rank, setRank] = useState<string>("-");
  const [apDots, setApDots] = useState<boolean[]>([]);   // true = used
  const [gameOverData, setGameOverData] = useState({ rank: 1, territory: 0 });
  const [error, setError] = useState("");

  // ===== REFS (không trigger re-render) =====
  /**
   * 📚 KIẾN THỨC: Tại sao pendingActions là ref, không phải state?
   *
   * pendingActions thay đổi mỗi khi click ô → rất thường xuyên.
   * Nếu dùng useState → mỗi click gây re-render → grid bị recreate
   * → mất hết onClick listeners trên từng ô.
   *
   * useRef: thay đổi .current không trigger re-render.
   * Chỉ cần update UI (AP dots) riêng biệt qua state.
   */
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<ConquestGrid | null>(null);
  const rendererRef = useRef<ConquestRenderer | null>(null);
  const pendingActionsRef = useRef<PendingAction[]>([]);
  const currentAPRef = useRef(3);
  const maxAPRef = useRef(3);
  const hasSubmittedRef = useRef(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const failsafeRef = useRef<NodeJS.Timeout | null>(null);
  const roomCodeRef = useRef("");
  const playerIdRef = useRef("");

  // Sync refs với searchParams
  useEffect(() => {
    const code = searchParams.get("roomCode");
    const nickname = searchParams.get("nickname");
    const avatar = searchParams.get("avatar");
    if (code && nickname) {
      roomCodeRef.current = code;
      socket.emit("joinConquestRoom", { roomCode: code, nickname, avatar });
    }
  }, [searchParams, socket]);

  // ===== AP DISPLAY HELPER =====
  function updateAPDisplay(currentAP: number, maxAP: number) {
    // true = ô đã dùng (AP spent), false = còn AP
    setApDots(Array.from({ length: maxAP }, (_, i) => i < maxAP - currentAP));
  }

  // ===== GRID INIT =====
  function initGrid(mapState: GridState) {
    if (!gridContainerRef.current) return;

    if (!gridRef.current) {
      // Lần đầu: tạo grid và renderer
      gridRef.current = new ConquestGrid(10);
      rendererRef.current = new ConquestRenderer(gridContainerRef.current, gridRef.current, {
        clickable: true,
      });
      // Set click handler
      rendererRef.current.onCellClick = handleCellClick;
      rendererRef.current.render();
    }

    // Update grid data
    gridRef.current.import(mapState);

    // Cập nhật từng ô (không re-render toàn bộ để giữ listeners)
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        rendererRef.current!.updateCell(x, y);
      }
    }
  }

  // ===== CELL CLICK HANDLER =====
  function handleCellClick(x: number, y: number) {
    if (!gridRef.current || !rendererRef.current) return;

    // Ô đã có chủ → không click được
    if (gridRef.current.getCell(x, y) !== null) return;

    const actionKey = `${x},${y}`;
    const existingIndex = pendingActionsRef.current.findIndex(a => `${a.x},${a.y}` === actionKey);

    if (existingIndex >= 0) {
      // Undo: bỏ chọn ô
      pendingActionsRef.current.splice(existingIndex, 1);
      currentAPRef.current++;
      rendererRef.current.markPending(x, y, false);
    } else {
      // Select: đặt AP vào ô
      if (currentAPRef.current > 0) {
        pendingActionsRef.current.push({ x, y });
        currentAPRef.current--;
        rendererRef.current.markPending(x, y, true);
      }
    }

    updateAPDisplay(currentAPRef.current, maxAPRef.current);
  }

  // ===== SUBMIT ACTIONS =====
  function submitActions() {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    if (pendingActionsRef.current.length > 0) {
      socket.emit("conquestSubmitActions", {
        roomCode: roomCodeRef.current,
        actions: pendingActionsRef.current,
      });
    }
  }

  // ===== TIMER =====
  function startTimer(seconds: number) {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (failsafeRef.current) clearTimeout(failsafeRef.current);

    let remaining = seconds;
    setTimer(remaining);
    setIsTimerWarning(false);

    timerIntervalRef.current = setInterval(() => {
      remaining--;
      setTimer(remaining);
      setIsTimerWarning(remaining <= 3);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current!);
        submitActions();
      }
    }, 1000);

    // Failsafe: force submit 1 giây sau khi hết giờ
    failsafeRef.current = setTimeout(() => submitActions(), (seconds + 1) * 1000);
  }

  // ===== SOCKET EVENTS =====
  useEffect(() => {
    socket.on("conquestJoined", ({ roomCode: code, playerId: id }: any) => {
      roomCodeRef.current = code;
      playerIdRef.current = id;
      setScreen("playing");
    });

    socket.on("conquestRoundStart", (data: any) => {
      const { roundNumber, maxRounds, currentAP, mapState, duration } = data;
      setRoundDisplay(`Round ${roundNumber}/${maxRounds}`);

      // Reset per-round state (dùng ref vì không cần re-render ngay)
      currentAPRef.current = currentAP;
      maxAPRef.current = currentAP;
      pendingActionsRef.current = [];
      hasSubmittedRef.current = false;
      updateAPDisplay(currentAP, currentAP);

      // Init/update grid
      initGrid(mapState);

      // Start timer
      startTimer(duration / 1000);
    });

    socket.on("conquestRoundEnd", (data: any) => {
      const { mapState, conflicts, yourTerritory, yourRank } = data;

      if (gridRef.current) {
        gridRef.current.import(mapState);
      }

      // Show conflict flash
      conflicts?.forEach(({ x, y }: PendingAction) => {
        rendererRef.current?.showConflict(x, y);
      });

      // Update all cells
      if (rendererRef.current && gridRef.current) {
        for (let x = 0; x < 10; x++) {
          for (let y = 0; y < 10; y++) {
            rendererRef.current.updateCell(x, y);
          }
        }
      }

      setTerritory(yourTerritory ?? 0);
      setRank(yourRank ? `#${yourRank}` : "-");
      pendingActionsRef.current = [];
    });

    socket.on("conquestGameOver", (data: any) => {
      const { yourRank, yourTerritory } = data;
      setGameOverData({ rank: yourRank ?? 1, territory: yourTerritory ?? 0 });
      setScreen("gameOver");
    });

    socket.on("conquestRoomReset", () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (failsafeRef.current) clearTimeout(failsafeRef.current);
      pendingActionsRef.current = [];
      hasSubmittedRef.current = false;
      currentAPRef.current = 3;
      gridRef.current = null;
      rendererRef.current = null;
      setScreen("playing");
      setRoundDisplay("Round 1/12");
      setTimer(12);
      setTerritory(0);
      setRank("-");
    });

    socket.on("error", ({ message }: any) => setError(message));

    return () => {
      socket.off("conquestJoined");
      socket.off("conquestRoundStart");
      socket.off("conquestRoundEnd");
      socket.off("conquestGameOver");
      socket.off("conquestRoomReset");
      socket.off("error");
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (failsafeRef.current) clearTimeout(failsafeRef.current);
    };
  }, [socket]);

  return (
    <div
      className="min-h-screen flex flex-col text-white"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* ===== WAITING SCREEN ===== */}
      {screen === "waiting" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 text-center p-6"
          style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", zIndex: 50 }}>
          <div className="text-6xl">⏳</div>
          <div className="text-3xl font-bold">Đang kết nối...</div>
          <div className="text-white/70">Nhập mã phòng để tham gia</div>
          {error && <div className="text-red-300 text-sm">{error}</div>}
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ===== GAME OVER SCREEN ===== */}
      {screen === "gameOver" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 text-center p-6"
          style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", zIndex: 50 }}>
          <div className="text-6xl">🏆</div>
          <div className="text-4xl font-bold">Trò Chơi Kết Thúc!</div>
          <div className="text-7xl font-bold text-yellow-400">#{gameOverData.rank}</div>
          <div className="text-2xl">{gameOverData.territory} territories</div>
          <div className="text-white/70">Cảm ơn bạn đã chơi!</div>
          <button
            onClick={() => { socket.removeAllListeners(); router.push("/player"); }}
            className="px-8 py-4 bg-white text-purple-700 font-bold rounded-2xl text-lg hover:-translate-y-1 transition-all"
          >
            🎮 CHƠI LẠI
          </button>
        </div>
      )}

      {/* ===== PLAYING SCREEN ===== */}
      {screen === "playing" && (
        <div className="flex flex-col h-screen">
          {/* Header */}
          <div className="bg-white/15 backdrop-blur-sm p-3">
            <div className="text-center font-bold text-lg">🏛️ ĐẠI CHIẾN GIẢNG ĐƯỜNG</div>
            <div className="flex justify-between items-center mt-2">
              <div className="text-sm text-white/80">{roundDisplay}</div>
              {/* Timer */}
              <div className={`text-4xl font-bold transition-colors ${isTimerWarning ? "text-red-400 animate-pulse" : "text-white"}`}>
                {timer}
              </div>
              {/* AP Dots */}
              <div className="flex gap-1">
                {apDots.map((used, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 border-white/50 transition-all ${used ? "bg-white/30" : "bg-white"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Grid — flex-1 để chiếm hết phần giữa */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-2">
            {/**
             * 📚 NHẮC LẠI: ref pattern
             *
             * div này là "container" cho ConquestRenderer.
             * React quản lý việc mount/unmount div.
             * ConquestRenderer quản lý nội dung bên trong.
             */}
            <div ref={gridContainerRef} />
          </div>

          {/* Footer stats */}
          <div className="bg-white/15 backdrop-blur-sm p-3">
            <div className="flex justify-around text-center">
              <div>
                <div className="text-xs text-white/60">Your Territory</div>
                <div className="text-2xl font-bold text-yellow-400">{territory}</div>
              </div>
              <div>
                <div className="text-xs text-white/60">Your Rank</div>
                <div className="text-2xl font-bold">{rank}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConquestPlayerPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}
      >
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ConquestPlayerContent />
    </Suspense>
  );
}
