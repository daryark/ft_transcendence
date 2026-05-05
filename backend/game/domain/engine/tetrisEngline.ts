const { collision, moveFigure } = require("./logic");

module.exports = function createEngine(room, roomService) {
    // const inputs = [];

    // function pushInput(input) {
    //     inputs.push(input);
    // }

    function applyInput(state, input) {
        while (inputs.length) {
            let piece = state.current;

            if (input === "left") piece = moveFigure(piece, -1, 0);
            if (input === "right") piece = moveFigure(piece, 1, 0);
            if (input === "down") piece = moveFigure(piece, 0, 1);

            if (input === "rotate") {
                const rotated = rotate(piece.shape);
                const test = { ...piece, shape: rotated };
                if (!collision(state.board, test)) piece = test;
            }

            if (!collision(state.board, piece)) { 
                state.current = piece;
            }
        }
    }

    function applyGravity(state) {
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

    function spawnPiece(state) {
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

    function lock(state) {
        state.current.shape.forEach((row, r) => {
            row.forEach((cell, c) => {
            if (cell) {
                const y = state.current.y + r;
                const x = state.current.x + c;
                if (y >= 0) state.board[y][x] = 1;
            }
            });
        });
    }

    function tick() {
        const state = room.state;

            applyInputs(state);
            applyGravity(state);

            roomService.broadcast(room.id, "game:update")
    }

    const loop = setInterval(() => {
    const state = room.state;
    applyInput(state, inputs.shift());
    applyGravity(state);
    roomService.broadcast(room.id, "game:update", state);
    }, 100);

  return { pushInput, stop: () => clearInterval(loop) };
}



import {
  moveFigure,
  collision,
  clearLines,
  createBag
} from "./logic";
import type { GameState } from "./state";
import type { Figure } from "./figures";

//!create Room type in room/
type Room = {
  id: string;
  state: GameState;
  status: "lobby" | "playing";
  engine?: any;
};
//!
type RoomService = {
  broadcast: (roomId: string, event: string, payload: any) => void;
};

type Input =
  | { type: "left" }
  | { type: "right" }
  | { type: "down" }
  | { type: "rotate" }
  | { type: "drop" }
  | { type: "hold" };

export default function createEngine(room: Room, roomService: RoomService) {
  const TICK = 100; // 100–200ms нормально для початку
  const inputs: Input[] = [];

  function pushInput(input: Input) {
    inputs.push(input);
  }

  function spawnPiece(state: GameState) {
    if (state.next.length === 0) {
      state.next = createBag().map(type => createFigure(type)); // залежить від твоєї реалізації
    }

    const next = state.next.shift();
    if (!next) return;

    state.current = {
      ...next,
      x: Math.floor((state.cols - next.shape[0].length) / 2),
      y: -2
    };
  }

  function applyInputs(state: GameState) {
    while (inputs.length) {
      const input = inputs.shift()!;

      if (!state.current) continue;

      if (input.type === "left") {
        const f = moveFigure(state.current, -1, 0);
        if (!collision(state.board, f)) state.current = f;
      }

      if (input.type === "right") {
        const f = moveFigure(state.current, 1, 0);
        if (!collision(state.board, f)) state.current = f;
      }

      if (input.type === "down") {
        const f = moveFigure(state.current, 0, 1);
        if (!collision(state.board, f)) state.current = f;
      }

      // rotate / drop додаси пізніше
    }
  }

  function lock(state: GameState) {
    const f = state.current!;
    f.shape.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell) {
          const x = f.x + dx;
          const y = f.y + dy;
          if (y >= 0) state.board[y][x] = 1;
        }
      });
    });
  }

  function tick() {
    const state = room.state;

    if (!state.current) {
      spawn(state);
    }

    applyInputs(state);

    if (!state.current) return;

    const moved = moveFigure(state.current, 0, 1);

    if (!collision(state.board, moved)) {
      state.current = moved;
    } else {
      lock(state);

      const { newBoard } = clearLines(state.board);
      state.board = newBoard;

      spawn(state);
    }

    roomService.broadcast(room.id, "game:update", state);
  }

  const interval = setInterval(tick, TICK);

  return {
    pushInput,
    stop() {
      clearInterval(interval);
    }
  };
}