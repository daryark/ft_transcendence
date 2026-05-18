import { create } from "node:domain";
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

export type BoardWidth = number & { __brand: "BoardWidth" };
export type BoardHeight = number & { __brand: "BoardHeight" };



function createBoardWidth(value: number): BoardWidth {
  if (value < 4 || value > 20)
    throw new Error("Invalid board width");

  return value as BoardWidth;
}

function createBoardHeight(value: number): BoardHeight {
  if (value < 4 || value > 40)
    throw new Error("Invalid board height");

  return value as BoardHeight;
}

export function createFigure(type: FigureType, cols: number): Figure {
  const shape = figures[type][0];

  return {
    type,
    shape,
    x: Math.floor((cols - shape[0].length) / 2),
    y: -2,
  };
}

export function createEmptyBoard(rows: BoardHeight, cols: BoardWidth): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
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

