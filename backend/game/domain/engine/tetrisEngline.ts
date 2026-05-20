import {
  moveFigure,
  rotate,
  collision,
  clearLines,
  createBag
} from "./logic";
import { createFigure } from "./state"
import Room from "../room";
import type { RoomId } from "../room";
import type { GameState } from "./state";
import type { ServerToClientEvents } from "../../../sockets/gameHandlers";

type RoomService = {
  broadcast: (roomId: RoomId, event: ServerToClientEvents, payload: any) => void;
};

//!inputs in GameState or where?
export type Input =
  | { type: "left" }
  | { type: "right" }
  | { type: "down" } //speed up soft drop
  | { type: "rotate" }
  | { type: "rotateCCW" } //!add later
  | { type: "rotate180" } //!add later
  | { type: "drop" }
  | { type: "hold" };

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

  function applyInputs(state: GameState, input: Input) {
    while (inputs.length) {
      let piece = state.current;

      if (input.type === "left") piece = moveFigure(piece, -1, 0);
      if (input.type === "right") piece = moveFigure(piece, 1, 0);
      if (input.type === "down") piece = moveFigure(piece, 0, 1);
      if (input.type === "down") piece = moveFigure(piece, 0, 1); //speed up soft drop

      if (input.type === "rotate") {
        const rotated = rotate(piece.shape);
        const test = { ...piece, shape: rotated };
        if (!collision(state.board, test)) piece = test;
      }
      // rotate / drop додаси пізніше
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

    applyInputs(state, inputs.shift()!); //!inputs.shift()! - means that no undefined will be, for TS. or add a check for undefined
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