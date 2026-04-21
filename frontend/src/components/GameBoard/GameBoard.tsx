import React, { useRef, useEffect } from "react";

import {
  moveFigure,
  collision,
  clearLines,
  rotate,
  getGhostPosition,
} from "../../pages/game/logic";

import { figureColors } from "../../pages/game/figures";
import { spawnPiece } from "../../pages/game/state";
import type { GameState } from "../../pages/game/state";

interface Props {
  rows: number;
  cols: number;
  cellSize: number;

  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;

  onHold: () => void;
  onRestart: () => void;
}

//need to update and add 
const GameBoard: React.FC<Props> = ({
  rows,
  cols,
  cellSize,
  gameState,
  setGameState,
  onHold,
  onRestart,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const BUFFER = 2;
  const offsetY = BUFFER * cellSize;

  //  game loop
  useEffect(() => {
    if (gameState.gameOver) return;

    const interval = setInterval(() => {
      setGameState((prev) => {
        let moved = moveFigure(prev.current, 0, 1);

        if (collision(prev.board, moved)) {
          const newBoard = prev.board.map((row) => [...row]);

          prev.current.shape.forEach((row, r) => {
            row.forEach((cell, c) => {
              if (cell) {
                const y = prev.current.y + r;
                const x = prev.current.x + c;
                if (y >= 0) newBoard[y][x] = 1;
              }
            });
          });

          const { newBoard: clearedBoard } = clearLines(newBoard);

          return spawnPiece({
            ...prev,
            board: clearedBoard,
          });
        }

        return { ...prev, current: moved };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [gameState.gameOver, setGameState]);

 //movement 
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState.gameOver) return;

      setGameState((prev) => {
        let piece = { ...prev.current };

        if (e.key === "ArrowLeft") piece = moveFigure(piece, -1, 0);
        if (e.key === "ArrowRight") piece = moveFigure(piece, 1, 0);
        if (e.key === "ArrowDown") piece = moveFigure(piece, 0, 1);

        if (e.key === "ArrowUp") {
          const rotated = rotate(piece.shape);
          const test = { ...piece, shape: rotated };
          if (!collision(prev.board, test)) piece = test;
        }

        // HARD DROP
        if (e.key === " ") {
          while (!collision(prev.board, piece)) {
            piece = moveFigure(piece, 0, 1);
          }
          piece.y -= 1;

          const newBoard = prev.board.map((row) => [...row]);

          piece.shape.forEach((row, r) => {
            row.forEach((cell, c) => {
              if (cell) {
                const y = piece.y + r;
                const x = piece.x + c;
                if (y >= 0) newBoard[y][x] = 1;
              }
            });
          });

          const { newBoard: clearedBoard } = clearLines(newBoard);

          return spawnPiece({
            ...prev,
            board: clearedBoard,
          });
        }

        //hold - move to different file (future) ////
        if (e.key === "c") {
          onHold(); 
          return prev;
        }

        if (collision(prev.board, piece)) return prev;

        return { ...prev, current: piece };
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState.gameOver, setGameState, onHold]);

  // render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cols * cellSize;
    canvas.height = (rows + BUFFER) * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // grid (update to color like figures)
    ctx.strokeStyle = "#444";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.strokeRect(
          c * cellSize,
          r * cellSize + offsetY,
          cellSize,
          cellSize
        );
      }
    }

    // bord show
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gameState.board[r][c]) {
          ctx.fillStyle = "#666";
          ctx.fillRect(
            c * cellSize,
            r * cellSize + offsetY,
            cellSize,
            cellSize
          );
        }
      }
    }

    // gost figure 
    const ghost = getGhostPosition(gameState.board, gameState.current);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = figureColors[ghost.type];

    ghost.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          ctx.fillRect(
            (ghost.x + c) * cellSize,
            (ghost.y + r) * cellSize + offsetY,
            cellSize,
            cellSize
          );
        }
      });
    });

    ctx.globalAlpha = 1;

    // current
    const piece = gameState.current;
    ctx.fillStyle = figureColors[piece.type];

    piece.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          ctx.fillRect(
            (piece.x + c) * cellSize,
            (piece.y + r) * cellSize + offsetY,
            cellSize,
            cellSize
          );
        }
      });
    });

    // game over
    if (gameState.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${cellSize}px monospace`;
      ctx.textAlign = "center";

      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    }
  }, [gameState, cols, rows, cellSize]);

  // reset game
  useEffect(() => {
    const handleRestart = (e: KeyboardEvent) => {
      if (e.key === "r") onRestart();
    };

    window.addEventListener("keydown", handleRestart);
    return () => window.removeEventListener("keydown", handleRestart);
  }, [onRestart]);

  return <canvas ref={canvasRef} />;
};

export default GameBoard;