import { moveFigure, rotate, collision, clearLines, createBag } from "./logic";
import { createFigure } from "./figures";
import type { Input, InputType } from "./input";
import Room from "../room";
import type { RoomId } from "../room";
import type { GameState } from "./state";
import type { ServerToClientEvents } from "../../../sockets/gameHandlers";

type RoomService = {
  broadcast: (roomId: RoomId, event: ServerToClientEvents, payload: any) => void;
};

type InputHandler = (state: GameState) => void;

export default function createEngine(room: Room, roomService: RoomService) {
  const TICK = 100; // 100–200ms ok for most players
  const inputs: Input[] = [];

  function pushInput(input: Input) {
    inputs.push(input);
  }

  function spawnPiece(state: GameState) {
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
      const { newBoard } = clearLines(state.board);
      state.board = newBoard;
      spawnPiece(state);
    } else {
      state.current = moved;
    }
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

    roomService.broadcast(room.id, "game:update", state);
  }


  const interval = setInterval(tick, TICK); //name interval/loop

  return {
    pushInput,
    stop() {
      clearInterval(interval);
    }
  };
}
