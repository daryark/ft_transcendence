"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyBoard = createEmptyBoard;
exports.initGame = initGame;
exports.spawnPiece = spawnPiece;
const figures_1 = require("./figures");
const logic_1 = require("./logic");
const logic_2 = require("./logic");
function createFigure(type, cols) {
    const shape = figures_1.figures[type][0];
    return {
        type,
        shape,
        x: Math.floor((cols - shape[0].length) / 2),
        y: -2,
    };
}
function createEmptyBoard(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}
function initGame(rows, cols) {
    const bag = (0, logic_1.createBag)();
    const nextTypes = [...bag, ...(0, logic_1.createBag)()];
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
function spawnPiece(state) {
    let next = [...state.next];
    if (next.length < 5) {
        next.push(...(0, logic_1.createBag)().map((t) => createFigure(t, state.cols)));
    }
    let current = next.shift();
    current = {
        ...current,
        x: Math.floor((state.cols - current.shape[0].length) / 2),
        y: -2,
    };
    // Game over -  новая фигура сразу коллайдит с доской
    const isGameOver = (0, logic_2.collision)(state.board, { ...current, y: 0 });
    return {
        ...state,
        current,
        next,
        canHold: true,
        gameOver: isGameOver,
    };
}
