import { createFigure, Figure } from "./figures";
import { createBag } from "./logic";
import { createBoardHeight, createBoardWidth, createEmptyBoard } from "./board";
import type { SoloConfig } from "../../config/gameConfig.types";

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
  piecesPlaced: number;
  round: number;
  startedAt: number;
  update: GameUpdateStats;
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
    type: SoloConfig["objective"]["winCondition"];
    current: number;
    target: number | null;
    remaining: number | null;
    complete: boolean;
  } | null;
}

export interface GameUpdateStats extends GameStats {
  scoreAdded?: number;
  linesCleared?: number;
}

export function buildGameStats(
  state: Pick<
    GameState,
    "score" | "lines" | "piecesPlaced" | "round" | "startedAt"
  >,
  objective?: SoloConfig["objective"],
): GameStats {
  const serverNow = Date.now();
  const elapsedMs = Math.max(0, serverNow - state.startedAt);
  const elapsedSeconds = elapsedMs / 1000;
  let objectiveStats: GameStats["objective"] = null;

  if (objective) {
    const target =
      objective.winCondition === "lines"
        ? objective.linesToClear ?? null
        : objective.winCondition === "score"
          ? objective.scoreToWin ?? null
          : objective.winCondition === "time"
            ? (objective.timeLimit ?? 0) * 1000
            : null;
    const current =
      objective.winCondition === "lines"
        ? state.lines
        : objective.winCondition === "score"
          ? state.score
          : objective.winCondition === "time"
            ? elapsedMs
            : 0;

    objectiveStats = {
      type: objective.winCondition,
      current,
      target,
      remaining: target === null ? null : Math.max(0, target - current),
      complete: target !== null && current >= target,
    };
  }

  return {
    score: state.score,
    lines: state.lines,
    piecesPlaced: state.piecesPlaced,
    elapsedMs,
    remainingMs:
      objectiveStats?.type === "time" ? objectiveStats.remaining : null,
    piecesPerSecond:
      elapsedSeconds > 0 ? state.piecesPlaced / elapsedSeconds : 0,
    round: state.round,
    serverNow,
    objective: objectiveStats,
  };
}

export function initGame(
  rows: number,
  cols: number,
  round = 1,
  startedAt = Date.now(),
): GameState {
  const board = createEmptyBoard(createBoardHeight(rows), createBoardWidth(cols));
  const bag = createBag();
  const nextTypes = [...bag, ...createBag()];
  const next = nextTypes.map((t) => createFigure(t, cols));
  const state: GameState = {
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
    piecesPlaced: 0,
    round,
    startedAt,
    update: {
      score: 0,
      lines: 0,
      piecesPlaced: 0,
      elapsedMs: 0,
      remainingMs: null,
      piecesPerSecond: 0,
      round,
      serverNow: Date.now(),
      objective: null,
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
