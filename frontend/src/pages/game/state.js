import { figures } from "./figures";
import { createBag } from "./logic";
import { collision } from "./logic";
function createFigure(type, cols) {
    const shape = figures[type][0];
    return {
        type,
        shape,
        x: Math.floor((cols - shape[0].length) / 2),
        y: -2,
    };
}
export function createEmptyBoard(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}
export function initGame(rows, cols) {
    const bag = createBag();
    const nextTypes = [...bag, ...createBag()];
    const next = nextTypes.map((t) => createFigure(t, cols));
    return {
        board: createEmptyBoard(rows, cols),
        current: next.shift(),
        next,
        hold: null,
        canHold: true,
        rows,
        cols,
        gameOver: false,
        score: 0,
        lines: 0,
    };
}
export function spawnPiece(state) {
    let next = [...state.next];
    if (next.length < 5) {
        next.push(...createBag().map((t) => createFigure(t, state.cols)));
    }
    let current = next.shift();
    current = {
        ...current,
        x: Math.floor((state.cols - current.shape[0].length) / 2),
        y: -2,
    };
    // Game over -  новая фигура сразу коллайдит с доской
    const isGameOver = collision(state.board, { ...current, y: 0 });
    return {
        ...state,
        current,
        next,
        canHold: true,
        gameOver: isGameOver,
    };
}
