import type { Figure, FigureType } from "./figures";
import type { GameState } from "./state";

const BAG: FigureType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export function createBag(): FigureType[] {
  return [...BAG].sort(() => Math.random() - 0.5);
}

export function moveFigure(f: Figure, dx: number, dy: number): Figure {
  return { ...f, x: f.x + dx, y: f.y + dy };
}

export function rotate(matrix: number[][]): number[][] {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}

export function collision(board: number[][], f: Figure): boolean {
  for (let r = 0; r < f.shape.length; r++) {
    for (let c = 0; c < f.shape[r].length; c++) {
      if (f.shape[r][c]) {
        const x = f.x + c;
        const y = f.y + r;

        if (y < 0) continue;

        if (
          x < 0 ||
          x >= board[0].length ||
          y >= board.length ||
          board[y]?.[x] !== 0
        )
          return true;
      }
    }
  }
  return false;
}

const LINE_SCORES = [0, 100, 300, 500, 800];

export function clearLines(board: number[][], level = 1) {
  const newBoard = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = board.length - newBoard.length;

  for (let i = 0; i < cleared; i++) {
    newBoard.unshift(Array(board[0].length).fill(0));
  }

  return {
    newBoard,
    cleared,
    scoreAdd: LINE_SCORES[cleared] * level,
  };
}

// export function clearLines(board: number[][]) {
//   const newBoard = board.filter((row) => row.some((cell) => cell === 0));
//   const cleared = board.length - newBoard.length;

//   for (let i = 0; i < cleared; i++) {
//     newBoard.unshift(Array(board[0].length).fill(0));
//   }

//   return { newBoard, cleared };
// }

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

    // ✅ ВАЖНО — копия массива!
    newNext = [...state.next];
  }

  newCurrent = {
    ...newCurrent,
    x: Math.floor((state.cols - newCurrent.shape[0].length) / 2),
    y: -2,
  };

  return {
    ...state,
    current: newCurrent,
    hold: newHold,
    canHold: false,
    next: newNext,
  };
}

// export function holdPiece(state: GameState): GameState {
//   if (!state.canHold) return state;

//   let newCurrent: Figure;
//   let newHold: Figure;
//   let newNext = state.next;

//   if (!state.hold) {

//     const [first, ...rest] = state.next;

//     newCurrent = first;
//     newNext = rest;

//     newHold = state.current;
//   } else {
//     newCurrent = state.hold;
//     newHold = state.current;
//   }

//   newCurrent = {
//     ...newCurrent,
//     x: Math.floor((state.cols - newCurrent.shape[0].length) / 2),
//     y: -2,
//   };

//   return {
//     ...state,
//     current: newCurrent,
//     hold: newHold,
//     canHold: false,
//     next: newNext,
//   };
// }
