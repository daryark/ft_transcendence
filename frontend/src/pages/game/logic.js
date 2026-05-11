"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBag = createBag;
exports.moveFigure = moveFigure;
exports.rotate = rotate;
exports.collision = collision;
exports.clearLines = clearLines;
exports.getGhostPosition = getGhostPosition;
exports.holdPiece = holdPiece;
const BAG = ["I", "O", "T", "S", "Z", "J", "L"];
function createBag() {
    return [...BAG].sort(() => Math.random() - 0.5);
}
function moveFigure(f, dx, dy) {
    return { ...f, x: f.x + dx, y: f.y + dy };
}
function rotate(matrix) {
    return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}
function collision(board, f) {
    for (let r = 0; r < f.shape.length; r++) {
        for (let c = 0; c < f.shape[r].length; c++) {
            if (f.shape[r][c]) {
                const x = f.x + c;
                const y = f.y + r;
                if (y < 0)
                    continue;
                if (x < 0 ||
                    x >= board[0].length ||
                    y >= board.length ||
                    board[y]?.[x] !== 0)
                    return true;
            }
        }
    }
    return false;
}
const LINE_SCORES = [0, 100, 300, 500, 800];
function clearLines(board, level = 1) {
    const newBoard = board.filter((row) => row.some((cell) => cell === 0));
    const cleared = board.length - newBoard.length;
    for (let i = 0; i < cleared; i++) {
        newBoard.unshift(Array(board[0].length).fill(0));
    }
    return {
        newBoard,
        cleared,
        scoreAdd: LINE_SCORES[cleared] * level,
    };
}
function getGhostPosition(board, f) {
    let ghost = { ...f };
    while (!collision(board, ghost)) {
        ghost = moveFigure(ghost, 0, 1);
    }
    ghost.y -= 1;
    return ghost;
}
function holdPiece(state) {
    if (!state.canHold)
        return state;
    let newCurrent;
    let newHold;
    let newNext;
    if (!state.hold) {
        const [first, ...rest] = state.next;
        if (!first)
            return state;
        newCurrent = first;
        newNext = rest;
        newHold = state.current;
    }
    else {
        newCurrent = state.hold;
        newHold = state.current;
        //copy array important **
        newNext = [...state.next];
    }
    newCurrent = {
        ...newCurrent,
        x: Math.floor((state.cols - newCurrent.shape[0].length) / 2),
        y: -2,
    };
    return {
        ...state,
        current: newCurrent,
        hold: newHold,
        canHold: false,
        next: newNext,
    };
}
