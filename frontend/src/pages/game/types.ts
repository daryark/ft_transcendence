import type { GameConfig } from "../../../shared/types/config.types";

export type FigureType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface Figure {
  type: FigureType;
  shape: number[][];
  x: number;
  y: number;
}

export interface GameState {
  board: number[][];
  buffer?: number[][];
  current: Figure;
  next: Figure[];
  hold: Figure | null;
  canHold: boolean;
  rows: number;
  cols: number;
  gameOver: boolean;
  score: number;
  lines: number;
  piecesPlaced: number;
  round: number;
  mode?: "quickplay" | "custom";
  startedAt: number;
  update: GameUpdateStats;
  garbageQueue?: GarbageQueueItem[];
  quickplay?: QuickplayStats;
}

export interface GarbageQueueItem {
  id: string;
  lines: number;
  column: number;
  receivedAt: number;
  entersAt: number;
  status: "pending" | "warning";
}

export interface GameStats {
  score: number;
  lines: number;
  piecesPlaced: number;
  elapsedMs: number;
  remainingMs: number | null;
  piecesPerSecond: number;
  round: number;
  serverNow: number;
  objective: {
    type: "score" | "lines" | "time" | "none";
    current: number;
    target: number | null;
    remaining: number | null;
    complete: boolean;
  } | null;
}

export interface GameUpdateStats extends GameStats {
  scoreAdded?: number;
  linesCleared?: number;
  quickplay?: QuickplayStats;
}

export interface QuickplayStats {
  meters: number;
  floor: number;
  climbRank: number;
  climbSpeed: number;
}

export interface GameStartPayload {
  roomId: string;
  state: GameState;
  config?: GameConfig;
  players?: Record<string, VersusPlayerState>;
}

export interface GameEndPayload {
  roomId: string;
  winnerId?: number | string | null;
  reason:
    | "game_over"
    | "objective_complete"
    | "round_timeout"
    | "manual_exit";
  state: GameState;
  players?: Record<string, VersusPlayerState>;
  result?: {
    outcome: "win" | "defeat";
    stats: GameStats;
    progression?: Array<{
      playerId: string;
      xpDelta: number;
      level: number;
      xp: number;
    }>;
  };
}

export interface RoundEndPayload {
  roomId: string;
  round: number;
  reason: "game_over" | "objective_complete" | "round_timeout";
  winnerId?: number | string | null;
  players?: Record<string, VersusPlayerState>;
  roundWins?: Record<string, number>;
  roundsToWin?: number;
  label?: "match_point" | "tiebreaker" | null;
}

export interface VersusPlayerState {
  id: number | string;
  username: string;
  config?: GameConfig;
  state: GameState;
  stockLeft?: number;
  stockTotal?: number;
  quickplayMeters?: number;
  altitudeBonusMeters?: number;
  gameOver?: boolean;
}

export type PlayerMove =
  | "left"
  | "right"
  | "down"
  | "rotate"
  | "rotateCCW"
  | "rotate180"
  | "drop"
  | "hold";

export type PlayerMovePhase = "press" | "release";

export const figureColors: Record<FigureType, string> = {
  I: "#00e5ff",
  O: "#f7d13b",
  T: "#b86cff",
  S: "#41d873",
  Z: "#ff5a66",
  J: "#5b75ff",
  L: "#ffad42",
};

export const boardCellFigureTypes: Record<number, FigureType> = {
  1: "I",
  2: "O",
  3: "T",
  4: "S",
  5: "Z",
  6: "J",
  7: "L",
};

// export const figureColors: Record<FigureType, string> = {
//   I: "#00f0f0",
//   O: "#f0f000",
//   T: "#a000f0",
//   S: "#00f000",
//   Z: "#f00000",
//   J: "#0000f0",
//   L: "#f0a000",
// };
