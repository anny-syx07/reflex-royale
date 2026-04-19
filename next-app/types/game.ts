/**
 * 📚 KIẾN THỨC: TypeScript Types
 *
 * Đây là nơi định nghĩa "hình dạng" của data trong game.
 * TypeScript sẽ kiểm tra xem bạn có dùng đúng kiểu dữ liệu không.
 *
 * Ví dụ nếu bạn viết: const p: Player = { id: 123 }
 * TypeScript sẽ báo lỗi vì id phải là string, không phải number.
 *
 * Lợi ích: Giảm bug, IDE autocomplete tốt hơn.
 */

// Thông tin một người chơi
export interface Player {
  id: string;
  nickname: string;
  score: number;
  avatar?: string; // ? = optional, không bắt buộc
}

// Các loại round trong game
export type RoundType =
  | "COLOR_TAP"
  | "SWIPE"
  | "SHAKE"
  | "TAP_SPAM"
  | "DONT_TAP"
  | "QUICK_MATH"
  | "GYRO_BALANCE"
  | "ICON_HUNT"
  | "SOUND_CHECK"
  | "FINAL_BLITZ";

// Màu sắc hợp lệ
export type GameColor = "RED" | "BLUE" | "YELLOW" | "PURPLE";

// Hướng vuốt hợp lệ
export type SwipeDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

// Trạng thái game
export type GameState = "WAITING" | "PLAYING" | "FINISHED";

// Data của từng loại round (từ server gửi về)
export interface ColorRoundData {
  color: GameColor;
}

export interface SwipeRoundData {
  direction: SwipeDirection;
}

export interface ShakeRoundData {
  duration: number; // milliseconds
}

export interface TapSpamRoundData {
  duration: number;
}

export interface DontTapRoundData {
  isBomb: boolean;
  duration: number;
}

export interface QuickMathRoundData {
  task: "MIN" | "MAX";
  numbers: number[];
  correctAnswer: number;
  duration: number;
}

export interface GyroBalanceRoundData {
  duration: number;
}

export interface IconHuntRoundData {
  targetIcon: string;
  gridIcons: string[];
  targetPosition: number;
  freezeDuration: number;
  duration: number;
}

export interface SoundCheckRoundData {
  correctSound: { audio: string; image: string; name: string; id: string };
  correctSoundId: string;
  allSounds: { audio: string; image: string; name: string; id: string }[];
  duration: number;
}

export interface BlitzChallenge {
  type: "COLOR" | "SWIPE" | "TAP" | "MATH";
  color?: GameColor;
  direction?: SwipeDirection;
  task?: "MIN" | "MAX";
  numbers?: number[];
  answer?: number;
}

export interface FinalBlitzRoundData {
  challenges: BlitzChallenge[];
  challengeDuration: number;
  pointMultiplier: number;
  duration: number;
}

// Union type — roundData có thể là bất kỳ loại nào trong danh sách
export type RoundData =
  | ColorRoundData
  | SwipeRoundData
  | ShakeRoundData
  | TapSpamRoundData
  | DontTapRoundData
  | QuickMathRoundData
  | GyroBalanceRoundData
  | IconHuntRoundData
  | SoundCheckRoundData
  | FinalBlitzRoundData;

// Events từ server → client (Socket.IO)
export interface RoundStartEvent {
  roundNumber: number;
  totalRounds: number;
  roundType: RoundType;
  roundData: RoundData;
  startTime: number;
}

export interface ResponseResultEvent {
  correct: boolean;
  points: number;
  totalScore: number;
}

export interface LeaderboardUpdateEvent {
  leaderboard: Player[];
}

export interface GameOverEvent {
  finalLeaderboard: Player[];
}

export interface PlayerListUpdateEvent {
  players: Player[];
}
