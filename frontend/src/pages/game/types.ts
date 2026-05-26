export type FigureType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface Figure {
  type: FigureType;
  shape: number[][];
  x: number;
  y: number;
}

export interface GameState {
  board: number[][];
  current: Figure;
  next: Figure[];
  hold: Figure | null;
  canHold: boolean;
  rows: number;
  cols: number;
  gameOver: boolean;
  score: number;
  lines: number;
}

export interface GameStartPayload {
  roomId: string;
  state: GameState;
  config?: unknown;
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

export const figureColors: Record<FigureType, string> = {
  I: "#00e5ff",
  O: "#f7d13b",
  T: "#b86cff",
  S: "#41d873",
  Z: "#ff5a66",
  J: "#5b75ff",
  L: "#ffad42",
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
