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
  round: number;
  startedAt: number;
  update: GameUpdateStats;
}

export interface GameStats {
  score: number;
  lines: number;
  elapsedMs: number;
  round: number;
}

export interface GameUpdateStats extends GameStats {
  scoreAdded?: number;
  linesCleared?: number;
}

export function buildGameStats(state: Pick<GameState, "score" | "lines" | "round" | "startedAt">): GameStats {
  return {
    score: state.score,
    lines: state.lines,
    round: state.round,
    elapsedMs: Date.now() - state.startedAt,
  };
}

export function initGame(rows: number, cols: number, round = 1): GameState {
  const board = createEmptyBoard(createBoardHeight(rows), createBoardWidth(cols));
  const bag = createBag();
  const nextTypes = [...bag, ...createBag()];
  const next = nextTypes.map((t) => createFigure(t, cols));
  const startedAt = Date.now();

  const state = {
    board,
    current: next.shift()!,
    next,
    hold: null,
    canHold: true,
    rows,
    cols,
    gameOver: false,
    score: 0,
    lines: 0,
    round,
    startedAt,
    update: {
      score: 0,
      lines: 0,
      elapsedMs: 0,
      round,
    },
  };

  state.update = buildGameStats(state);
  return state;
}


// One room
//  ├── one engine
//  └── one shared match state
//        ├── player1 board
//        ├── player2 board
//        ├── garbage queue
//        └── match metadata

// GameState {
//   players: {
//     [playerId]: PlayerGameState
//   };

//   startedAt: number;
// }

// Each player has:

// own board,
// own piece,
// own score.

// But:

// same match,
// same tick timing,
// same engine loop.
