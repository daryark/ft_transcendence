import { figures } from "./figures";
import type { Figure, FigureType } from "./figures";
import { createBag } from "./logic";

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

function createFigure(type: FigureType, cols: number): Figure {
  const shape = figures[type][0];

  return {
    type,
    shape,
    x: Math.floor((cols - shape[0].length) / 2),
    y: -2,
  };
}

export function createEmptyBoard(rows: number, cols: number) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

export function initGame(rows: number, cols: number): GameState {
  const bag = createBag();
  const nextTypes = [...bag, ...createBag()];
  const next = nextTypes.map((t) => createFigure(t, cols));

  return {
    board: createEmptyBoard(rows, cols),
    current: next.shift()!,
    next,
    hold: null,
    canHold: true,
    rows,
    cols,
    gameOver: false,
    score: 0,
    lines: 0,
  };
}

