import { moveFigure, rotate, collision, clearLines, createBag } from "./logic";
import { createFigure } from "./figures";
import { buildGameStats } from "./state";
import type { Input, InputType } from "./input";
import Room from "../room";
import type { RoomId } from "../room";
import type { GameState, GameUpdateStats } from "./state";
import type { Figure } from "./figures";
import { figureCellValues } from "./figures";
import type { ServerToClientEvents } from "../../../sockets/gameHandlers";

type RoomService = {
  broadcast: (roomId: RoomId, event: ServerToClientEvents, payload: any) => void;
};

type InputHandler = (state: GameState) => boolean | void;

export type Engine = ReturnType<typeof createEngine>;

export const TICK_MS = 1000 / 60;
const MAX_INPUTS_PER_TICK = 30;
const ROTATION_KICKS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 2, y: 0 },
  { x: -2, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 2, y: -1 },
  { x: -2, y: -1 },
  { x: 0, y: -2 },
  { x: 1, y: -2 },
  { x: -1, y: -2 },
];

//!should i have separate methods to handle end of the game for each solo mode ?
//!as i will also have different end conditions for other multiplayer and custom modes!!!!
export default function createEngine(room: Room, roomService: RoomService) {
  const inputs: Input[] = [];
  let interval: ReturnType<typeof setInterval>;
  const gravityConfig = room.gameConfig.gravity;
  const gameStartedAt = room.state?.startedAt ?? Date.now();
  const gravityIncreaseInterval = gravityConfig.gravitMarginTime > 0 ? gravityConfig.gravitMarginTime : null;
  const lockDelayTicks = gravityConfig.lockDelay;
  let gravityValue = gravityConfig.gravity;
  let gravityAccumulator = 0;
  let nextGravityIncreaseAt = gravityIncreaseInterval ? gameStartedAt + gravityIncreaseInterval : null;
  let lockTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let currentPieceWasRotated = false;
  let pendingScoreAdded = 0;
  let pendingLinesCleared = 0;

  function clearLockTimeout() {
    if (lockTimeoutId !== null) {
      clearTimeout(lockTimeoutId);
      lockTimeoutId = null;
    }
  }

  function buildGameUpdate(state: GameState): GameUpdateStats {
    const objective =
      room.gameConfig.mode === "solo" ? room.gameConfig.objective : undefined;
    const update: GameUpdateStats = buildGameStats(state, objective);

    if (pendingScoreAdded > 0) {
      update.scoreAdded = pendingScoreAdded;
    }

    if (pendingLinesCleared > 0) {
      update.linesCleared = pendingLinesCleared;
    }

    pendingScoreAdded = 0;
    pendingLinesCleared = 0;
    return update;
  }

  function broadcastGameUpdate(state: GameState) {
    state.update = buildGameUpdate(state);
    roomService.broadcast(room.id, "game:update", state);
  }

  function scheduleLock(state: GameState) {
    if (lockTimeoutId !== null || !isTouchingGround(state)) return;

    const lockMultiplier = currentPieceWasRotated ? 1 : 0.5;
    const lockDelayMs = Math.max(1, Math.round(lockDelayTicks * TICK_MS * lockMultiplier));

    lockTimeoutId = setTimeout(() => {
      lockTimeoutId = null;

      if (room.status !== "playing" || room.state !== state) return;
      lockCurrent(state);
    }, lockDelayMs);
  }

  function pushInput(input: Input) {
    if (room.status !== "playing") return;

    if (input.phase === "release") {
      for (let index = inputs.length - 1; index >= 0; index -= 1) {
        if (inputs[index].type === input.type && inputs[index].repeat) {
          inputs.splice(index, 1);
        }
      }
      return;
    }

    inputs.push({
      type: input.type,
      phase: "press",
      repeat: input.repeat ?? false,
    });
  }

  function ensureNextQueue(state: GameState) {
    while (state.next.length < 7) {
      state.next.push(...createBag().map((t) => createFigure(t, state.cols)));
    }
  }

  function resetPiecePosition(piece: Figure, cols: number): Figure {
    return {
      ...piece,
      x: Math.floor((cols - piece.shape[0].length) / 2),
      y: -3,
    };
  }

  function resetPiece(type: Figure["type"], cols: number): Figure {
    return createFigure(type, cols);
  }

  function hasCollision(state: GameState, piece: Figure) {
    return collision(state.board, piece, state.buffer);
  }

  function spawnPiece(state: GameState) {
    ensureNextQueue(state);

    const nextPiece = state.next.shift();
    if (!nextPiece) {
      state.gameOver = true;
      return;
    }

    const current = resetPiecePosition(nextPiece, state.cols);

    state.current = current;
    state.canHold = true;
    currentPieceWasRotated = false;
    clearLockTimeout();
    state.gameOver = hasCollision(state, current);
  }

  function trySetCurrent(state: GameState, piece: Figure) {
    if (hasCollision(state, piece)) return false;

    state.current = piece;
    return true;
  }

  function tryMoveCurrent(state: GameState, dx: number, dy: number) {
    return trySetCurrent(state, moveFigure(state.current, dx, dy));
  }

  function rotateMatrix(matrix: number[][], turns: 1 | 2 | 3) {
    let rotated = matrix;

    for (let i = 0; i < turns; i += 1) {
      rotated = rotate(rotated);
    }

    return rotated;
  }

  function tryRotateCurrent(state: GameState, turns: 1 | 2 | 3) {
    const rotated = rotateMatrix(state.current.shape, turns);

    const rotatedSuccessfully = ROTATION_KICKS.some((kick) =>
      trySetCurrent(state, {
        ...state.current,
        shape: rotated,
        x: state.current.x + kick.x,
        y: state.current.y + kick.y,
      }),
    );

    if (rotatedSuccessfully) {
      currentPieceWasRotated = true;
    }

    return rotatedSuccessfully;
  }

  function lockCurrent(state: GameState) {
    let current = state.current;

    while (!hasCollision(state, moveFigure(current, 0, 1))) {
      current = moveFigure(current, 0, 1);
    }

    current.shape.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (!cell) return;

        const x = current.x + dx;
        const y = current.y + dy;

        if (y >= 0 && y < state.rows && x >= 0 && x < state.cols) {
          state.board[y][x] = figureCellValues[current.type];
        } else if (
          y < 0 &&
          y >= -state.buffer.length &&
          x >= 0 &&
          x < state.cols
        ) {
          state.buffer[state.buffer.length + y][x] =
            figureCellValues[current.type];
        }
      });
    });

    if (
      state.board
        .slice(0, Math.ceil(state.rows / 2))
        .some((row) => row.some((cell) => cell !== 0))
    ) {
      state.reachedHalfHeight = true;
    }

    const { newBoard, newBuffer, cleared, scoreAdd } = clearLines(
      state.board,
      1,
      state.buffer,
    );
    state.board = newBoard;
    state.buffer = newBuffer;
    state.lines += cleared;
    state.score += scoreAdd;
    state.piecesPlaced += 1;

    if (cleared > 0) {
      pendingLinesCleared += cleared;
      state.maxLinesCleared = Math.max(state.maxLinesCleared, cleared);
      state.clearedTwoAtOnce = state.clearedTwoAtOnce || cleared === 2;
      state.clearedThreeAtOnce = state.clearedThreeAtOnce || cleared === 3;
      state.currentCombo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.currentCombo);
      state.tetrises += cleared === 4 ? 1 : 0;
      state.clearedAfterHalfHeight =
        state.clearedAfterHalfHeight || state.reachedHalfHeight;
    } else {
      state.currentCombo = 0;
    }

    if (scoreAdd > 0) {
      pendingScoreAdded += scoreAdd;
    }

    spawnPiece(state);
    gravityAccumulator = 0;
    clearLockTimeout();
    currentPieceWasRotated = false;
  }

  function softDrop(state: GameState) {
    return tryMoveCurrent(state, 0, 1);
  }

  function hardDrop(state: GameState) {
    clearLockTimeout();
    state.hardDrops += 1;

    while (tryMoveCurrent(state, 0, 1)) {
      state.score += 2;
      pendingScoreAdded += 2;
    }

    lockCurrent(state);
    return true;
  }

  function holdCurrent(state: GameState) {
    if (!room.gameConfig.controls.hold || !state.canHold) return;

    state.holds += 1;
    const held = state.hold;
    state.hold = resetPiece(state.current.type, state.cols);
    state.canHold = false;

    if (held) {
      state.current = resetPiece(held.type, state.cols);
    } else {
      spawnPiece(state);
    }

    state.canHold = false;
    clearLockTimeout();
    currentPieceWasRotated = false;
    state.gameOver =
      state.gameOver ||
      hasCollision(state, state.current);
  }

  const inputHandlers: Record<InputType, InputHandler> = {
    left: (state) => tryMoveCurrent(state, -1, 0),
    right: (state) => tryMoveCurrent(state, 1, 0),
    down: softDrop,
    rotate: (state) => tryRotateCurrent(state, 1),
    rotateCCW: (state) => tryRotateCurrent(state, 3),
    rotate180: (state) => tryRotateCurrent(state, 2),
    drop: hardDrop,
    hold: holdCurrent,
  };

  function applyInputs(state: GameState) {
    let input: Input | undefined;
    let processed = 0;
    let lockedThisTick = false;

    while (processed < MAX_INPUTS_PER_TICK && (input = inputs.shift())) {
      if (state.gameOver) break;
      lockedThisTick =
        inputHandlers[input.type](state) === true || lockedThisTick;
      processed += 1;

      if (lockedThisTick) break;
    }

    return lockedThisTick;
  }

  function applyGravity(state: GameState) {
    const now = Date.now();

    if (gravityIncreaseInterval && gravityConfig.gravityIncrease > 0 && nextGravityIncreaseAt !== null) {
      while (now >= nextGravityIncreaseAt) {
        gravityValue = Math.min(1, gravityValue + gravityConfig.gravityIncrease);
        nextGravityIncreaseAt += gravityIncreaseInterval;
      }
    }

    gravityAccumulator += gravityValue;

    while (gravityAccumulator >= 1) {
      if (!tryMoveCurrent(state, 0, 1)) break;

      gravityAccumulator -= 1;
    }
  }

  function isTouchingGround(state: GameState) {
    return hasCollision(state, moveFigure(state.current, 0, 1));
  }

  function handleLockDelay(state: GameState) {
    if (!isTouchingGround(state)) return;

    scheduleLock(state);
  }

  function tick() {
    const state = room.state;
    if (!state) return; // Guard: state should not be null during active game
    if (room.status !== "playing") return;
    if (Date.now() < state.startedAt) {
      broadcastGameUpdate(state);
      return;
    }

    if (room.match?.evaluate(state)) return;
    const lockedByInput = applyInputs(state);
    if (room.match?.evaluate(state)) return;
    if (!lockedByInput) {
      applyGravity(state);
    }
    handleLockDelay(state);
    if (room.match?.evaluate(state)) return;

    broadcastGameUpdate(state);
  }


  interval = setInterval(tick, TICK_MS); //name interval/loop

  return {
    pushInput,
    stop() {
      clearInterval(interval);
    }
  };
}


// game ends
//     ↓
// calculate rewards/rank/level/xt/rankXp/wins/losses //if applicable
//     ↓
// persist to DB
//     ↓
// notify clients
