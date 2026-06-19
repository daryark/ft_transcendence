import { createFigure, Figure } from "./figures";
import { createBag } from "./logic";
import {
  createBoardHeight,
  createBoardWidth,
  createEmptyBoard,
  createEmptyBuffer,
} from "./board";
import type { SoloConfig } from "../../config/gameConfig.types";

export interface GameState {
  board: number[][];
  buffer: number[][];
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
  hardDrops: number;
  holds: number;
  currentCombo: number;
  maxCombo: number;
  maxLinesCleared: number;
  clearedTwoAtOnce: boolean;
  clearedThreeAtOnce: boolean;
  tetrises: number;
  reachedHalfHeight: boolean;
  clearedAfterHalfHeight: boolean;
  round: number;
  startedAt: number;
  update: GameUpdateStats;
  garbageQueue?: GarbageQueueItem[];
  bagSeed?: string | null;
  nextBagIndex?: number;
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
  hardDrops: number;
  holds: number;
  maxCombo: number;
  maxLinesCleared: number;
  clearedTwoAtOnce: boolean;
  clearedThreeAtOnce: boolean;
  tetrises: number;
  clearedAfterHalfHeight: boolean;
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
    | "hardDrops" | "holds" | "maxCombo" | "maxLinesCleared"
    | "clearedTwoAtOnce" | "clearedThreeAtOnce" | "tetrises"
    | "clearedAfterHalfHeight"
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
    hardDrops: state.hardDrops,
    holds: state.holds,
    maxCombo: state.maxCombo,
    maxLinesCleared: state.maxLinesCleared,
    clearedTwoAtOnce: state.clearedTwoAtOnce,
    clearedThreeAtOnce: state.clearedThreeAtOnce,
    tetrises: state.tetrises,
    clearedAfterHalfHeight: state.clearedAfterHalfHeight,
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
  sequence: { bagSeed?: string | null; nextBagIndex?: number } = {},
): GameState {
  const board = createEmptyBoard(createBoardHeight(rows), createBoardWidth(cols));
  const buffer = createEmptyBuffer(createBoardWidth(cols));
  const bagSeed = sequence.bagSeed ?? null;
  let nextBagIndex = Math.max(0, Math.floor(sequence.nextBagIndex ?? 0));
  const nextTypes = [
    ...createBag(bagSeed, nextBagIndex),
    ...createBag(bagSeed, nextBagIndex + 1),
  ];
  nextBagIndex += 2;
  const next = nextTypes.map((t) => createFigure(t, cols));
  const state: GameState = {
    board,
    buffer,
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
    hardDrops: 0,
    holds: 0,
    currentCombo: 0,
    maxCombo: 0,
    maxLinesCleared: 0,
    clearedTwoAtOnce: false,
    clearedThreeAtOnce: false,
    tetrises: 0,
    reachedHalfHeight: false,
    clearedAfterHalfHeight: false,
    round,
    startedAt,
    update: {
      score: 0,
      lines: 0,
      piecesPlaced: 0,
      hardDrops: 0,
      holds: 0,
      maxCombo: 0,
      maxLinesCleared: 0,
      clearedTwoAtOnce: false,
      clearedThreeAtOnce: false,
      tetrises: 0,
      clearedAfterHalfHeight: false,
      elapsedMs: 0,
      remainingMs: null,
      piecesPerSecond: 0,
      round,
      serverNow: Date.now(),
      objective: null,
    },
    garbageQueue: [],
    bagSeed,
    nextBagIndex,
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
