import { moveFigure, rotate, collision, clearLines, createBag } from "./logic";
import { createFigure } from "./figures";
import { initGame } from "./state";
import type { Input, InputType } from "./input";
import Room from "../room";
import type { RoomId } from "../room";
import type { GameState } from "./state";
import type { ServerToClientEvents } from "../../../sockets/gameHandlers";

type RoomService = {
  broadcast: (roomId: RoomId, event: ServerToClientEvents, payload: any) => void;
};

type InputHandler = (state: GameState) => void;

export type Engine = ReturnType<typeof createEngine>;


//!should i have separate methods to handle end of the game for each solo mode ?
//!as i will also have different end conditions for other multiplayer and custom modes!!!!
export default function createEngine(room: Room, roomService: RoomService) {
  const TICK = 100; // 100–200ms ok for most players
  const inputs: Input[] = [];
  let interval: ReturnType<typeof setInterval>;

  function pushInput(input: Input) {
    inputs.push(input);
  }

  function spawnPiece(state: GameState): GameState {
    let next = [...state.next];

    if (next.length < 5) {
      next.push(...createBag().map((t) => createFigure(t, state.cols)));
    }

    let current = next.shift()!;

    current = {
      ...current,
      x: Math.floor((state.cols - current.shape[0].length) / 2),
      y: -2,
    };

    const isGameOver = collision(state.board, { ...current, y: 0 });

    return {
      ...state,
      current,
      next,
      canHold: true,
      gameOver: isGameOver,
    };
  }

  function moveCurrent(state: GameState, dx: number, dy: number) {
    state.current = moveFigure(state.current, dx, dy);
  }

  function rotateCurrent(state: GameState) {
    const rotated = rotate(state.current.shape);
    const test = { ...state.current, shape: rotated };

    if (!collision(state.board, test)) {
      state.current = test;
    }
  }

  const inputHandlers: Record<InputType, InputHandler> = {
    left: (state) => moveCurrent(state, -1, 0),
    right: (state) => moveCurrent(state, 1, 0),
    down: (state) => moveCurrent(state, 0, 1),
    rotate: rotateCurrent,
    rotateCCW: () => {},
    rotate180: () => {},
    drop: () => {},
    hold: () => {},
  };

  function applyInputs(state: GameState) {
    let input: Input | undefined;

    while ((input = inputs.shift())) {
      inputHandlers[input.type](state);
    }
  }

  function applyGravity(state: GameState) {
    const moved = moveFigure(state.current, 0, 1);

    if (collision(state.board, moved)) {
      lock(state);
      const { newBoard, cleared, scoreAdd } = clearLines(state.board);
      state.board = newBoard;
      state.lines += cleared;
      state.score += scoreAdd;

      const nextState = spawnPiece(state);
      Object.assign(state, nextState);
    } else {
      state.current = moved;
    }
  }

  function shouldFinishByObjective(state: GameState): boolean {
    if (room.gameConfig.mode !== "solo") return false;

    const objective = room.gameConfig.objective;
    if (objective.winCondition === "none") return false;

    if (objective.winCondition === "score") {
      return state.score >= (objective.scoreToWin ?? Infinity);
    }

    if (objective.winCondition === "lines") {
      return state.lines >= (objective.linesToClear ?? Infinity);
    }

    if (objective.winCondition === "time") {
      const elapsedSeconds = (Date.now() - state.startedAt) / 1000;
      return elapsedSeconds >= (objective.timeLimit ?? Infinity);
    }

    return false;
  }

  function restartZenSolo(state: GameState) {
    room.state = initGame(state.rows, state.cols, state.round + 1);
    roomService.broadcast(room.id, "game:start", {
      roomId: room.id,
      state: room.state,
      config: room.gameConfig,
    });
  }

  function finishGame(reason: "game_over" | "objective_complete") {
    room.status = "ended";
    clearInterval(interval);
    roomService.broadcast(room.id, "game:end", {
      roomId: room.id,
      reason,
      state: room.state,
    });
  }

  function handleEndConditions(state: GameState): boolean {
    if (room.gameConfig.mode === "solo" && state.gameOver) {
      if (room.gameConfig.objective.winCondition === "none") {
        restartZenSolo(state);
        return true;
      }

      finishGame("game_over");
      return true;
    }

    if (shouldFinishByObjective(state)) {
      finishGame("objective_complete");
      return true;
    }

    return false;
  }

  function lock(state: GameState) {
    const curr = state.current!;
    curr.shape.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell) {
          const x = curr.x + dx;
          const y = curr.y + dy;
          if (y >= 0) state.board[y][x] = 1;
        }
      });
    });
  }

  function tick() {
    const state = room.state;
    if (!state) return; // Guard: state should not be null during active game

    applyInputs(state);
    applyGravity(state);
    if (handleEndConditions(state)) return; //!should check end conditions before applying movements?
    //!or after broadcasting update, so clients receive final state before end state?

    roomService.broadcast(room.id, "game:update", state);
  }


  interval = setInterval(tick, TICK); //name interval/loop

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
