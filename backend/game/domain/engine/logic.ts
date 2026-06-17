import type { Figure, FigureType } from "./figures";
import type { GameState } from "./state";
const BAG: FigureType[] = ["I", "O", "T", "S", "Z", "J", "L"];

function hashSequence(seed: string, bagIndex: number) {
  let hash = 0x811c9dc5;
  const input = `${seed}:${bagIndex}`;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleBag(random: () => number) {
  const bag = [...BAG];

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }

  return bag;
}

export function createIndexedBag(seed: string, bagIndex: number): FigureType[] {
  return shuffleBag(createSeededRandom(hashSequence(seed, bagIndex)));
}

export function createBag(seed?: string | null, bagIndex?: number): FigureType[] {
  if (seed && typeof bagIndex === "number") {
    return createIndexedBag(seed, bagIndex);
  }

  return shuffleBag(Math.random);
}

export function moveFigure(f: Figure, dx: number, dy: number): Figure {
  return { ...f, x: f.x + dx, y: f.y + dy };
}

export function rotate(matrix: number[][]): number[][] {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}

function getCell(
  board: number[][],
  buffer: number[][],
  x: number,
  y: number,
) {
  if (y >= 0) return board[y]?.[x];

  const bufferIndex = buffer.length + y;
  return bufferIndex >= 0 ? buffer[bufferIndex]?.[x] : 0;
}

export function collision(
  board: number[][],
  f: Figure,
  buffer: number[][] = [],
): boolean {
  for (let r = 0; r < f.shape.length; r++) {
    for (let c = 0; c < f.shape[r].length; c++) {
      if (f.shape[r][c]) {
        const x = f.x + c;
        const y = f.y + r;

        if (x < 0 || x >= board[0].length) return true;
        if (
          (buffer.length > 0 && y < -buffer.length) ||
          y >= board.length
        ) {
          return true;
        }
        if (getCell(board, buffer, x, y) !== 0) return true;
      }
    }
  }
  return false;
}

const LINE_SCORES = [0, 100, 300, 500, 800];

export function clearLines(
  board: number[][],
  level = 1,
  buffer: number[][] = [],
) {
  const combined = [...buffer, ...board];
  const remainingRows = combined.filter((row) =>
    row.some((cell) => cell === 0),
  );
  const cleared = combined.length - remainingRows.length;

  for (let i = 0; i < cleared; i++) {
    remainingRows.unshift(Array(board[0].length).fill(0));
  }

  return {
    newBoard: remainingRows.slice(buffer.length),
    newBuffer: remainingRows.slice(0, buffer.length),
    cleared,
    scoreAdd: LINE_SCORES[cleared] * level,
  };
}


export function getGhostPosition(board: number[][], f: Figure): Figure {
  let ghost = { ...f };

  while (!collision(board, ghost)) {
    ghost = moveFigure(ghost, 0, 1);
  }

  ghost.y -= 1;
  return ghost;
}

export function holdPiece(state: GameState): GameState {
  if (!state.canHold) return state;

  let newCurrent: Figure;
  let newHold: Figure;
  let newNext: Figure[];

  if (!state.hold) {
    const [first, ...rest] = state.next;

    if (!first) return state;

    newCurrent = first;
    newNext = rest;
    newHold = state.current;
  } else {
    newCurrent = state.hold;
    newHold = state.current;

    //copy array important **
    newNext = [...state.next];
  }

  newCurrent = {
    ...newCurrent,
    x: Math.floor((state.cols - newCurrent.shape[0].length) / 2),
    y: -3,
  };

  return {
    ...state,
    current: newCurrent,
    hold: newHold,
    canHold: false,
    next: newNext,
  };
}
