import { createFigure, Figure } from "./figures";
import { createBag } from "./logic";
import { createBoardHeight, createBoardWidth, createEmptyBoard } from "./board";

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

export function initGame(rows: number, cols: number): GameState {
  const board = createEmptyBoard(createBoardHeight(rows), createBoardWidth(cols));
  const bag = createBag();
  const nextTypes = [...bag, ...createBag()];
  const next = nextTypes.map((t) => createFigure(t, cols));

  return {
    board,
    current: next.shift()!,
    next,
    hold: null,
    canHold: true,
    rows,
    cols,
    gameOver: false,
    score: 0,
    lines: 0
  };
}
