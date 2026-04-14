import React, { useRef, useEffect, useState } from "react";

import {
  moveFigure,
  collision,
  clearLines,
  rotate,
  getGhostPosition,
  holdPiece,
} from "../../pages/game/logic";

import { figureColors } from "../../pages/game/figures";
import { initGame, spawnPiece } from "../../pages/game/state";
import type { GameState } from "../../pages/game/state";

interface Props {
  rows: number;
  cols: number;
  cellSize: number;
}

const GameBoard: React.FC<Props> = ({ rows, cols, cellSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<GameState>(initGame(rows, cols));

  const BUFFER = 2;

  const offsetY = BUFFER * cellSize; //?
  // game lopp +
  useEffect(() => {
    if (game.gameOver) return;
    const interval = setInterval(() => {
      setGame((prev) => {
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
  }, [game.gameOver]);

  // movement +
  useEffect(() => {
    if (game.gameOver) return;

    const handleKey = (e: KeyboardEvent) => {
      if (game.gameOver) return;
      setGame((prev) => {
        let piece = { ...prev.current };

        if (e.key === "ArrowLeft") piece = moveFigure(piece, -1, 0);
        if (e.key === "ArrowRight") piece = moveFigure(piece, 1, 0);
        if (e.key === "ArrowDown") piece = moveFigure(piece, 0, 1);

        if (e.key === "ArrowUp") {
          const rotated = rotate(piece.shape);
          const test = { ...piece, shape: rotated };
          if (!collision(prev.board, test)) piece = test;
        }

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

        if (e.key === "c") {
          return holdPiece(prev);
        }

        if (collision(prev.board, piece)) return prev;

        return { ...prev, current: piece };
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [game.gameOver]);

  // render +
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cols * cellSize;
    canvas.height = (rows + BUFFER) * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // fild +
    ctx.strokeStyle = "#444";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.strokeRect(
          c * cellSize,
          r * cellSize + offsetY,
          cellSize,
          cellSize,
        );
      }
    }

    // blocks +
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (game.board[r][c]) {
          ctx.fillStyle = "#666";
          ctx.fillRect(
            c * cellSize,
            r * cellSize + offsetY,
            cellSize,
            cellSize,
          );
        }
      }
    }

    // ghost figure +
    const ghost = getGhostPosition(game.board, game.current);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = figureColors[ghost.type];

    ghost.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          ctx.fillRect(
            (ghost.x + c) * cellSize,
            (ghost.y + r) * cellSize + offsetY,
            cellSize,
            cellSize,
          );
        }
      });
    });

    ctx.globalAlpha = 1;

    // current figure +
    const piece = game.current;
    ctx.fillStyle = figureColors[piece.type];

    piece.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          ctx.fillRect(
            (piece.x + c) * cellSize,
            (piece.y + r) * cellSize + offsetY,
            cellSize,
            cellSize,
          );
        }
      });
    });

    //game over block after
    if (game.gameOver) {
      // Затемнение
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Текст GAME OVER
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${cellSize * 1.2}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - cellSize);

      // Счёт
      ctx.font = `${cellSize * 0.8}px monospace`;
      ctx.fillStyle = "#aaa";
      ctx.fillText(
        `Score: ${game.score}`,
        canvas.width / 2,
        canvas.height / 2 + cellSize * 0.5,
      );

      // Подсказка рестарт
      ctx.font = `${cellSize * 0.6}px monospace`;
      ctx.fillStyle = "#666";
      ctx.fillText(
        "Press R to restart",
        canvas.width / 2,
        canvas.height / 2 + cellSize * 2,
      );
    }
  }, [game]);
  useEffect(() => {
    const handleRestart = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        setGame(initGame(rows, cols));
      }
    };

    window.addEventListener("keydown", handleRestart);
    return () => window.removeEventListener("keydown", handleRestart);
  }, [rows, cols]);

  return <canvas ref={canvasRef} />;
};


export default GameBoard;
