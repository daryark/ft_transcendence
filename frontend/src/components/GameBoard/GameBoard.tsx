import React, { useRef, useEffect } from "react";

interface Props {
  gameState: any; 
  cellSize: number;
}

const figureColors: Record<string, string> = {
  I: "#00f0f0",
  O: "#f0f000",
  T: "#a000f0",
  S: "#00f000",
  Z: "#f00000",
  J: "#0000f0",
  L: "#f0a000",
};

const GameBoard: React.FC<Props> = ({ gameState, cellSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { rows, cols, board, current, ghost } = gameState;

  const BUFFER = 2;
  const offsetY = BUFFER * cellSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cols * cellSize;
    canvas.height = (rows + BUFFER) * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // GRID
    ctx.strokeStyle = "#222";
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

    // BOARD
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c]) {
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

    // GHOST (с сервера)
    if (ghost) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = figureColors[ghost.type];

      ghost.shape.forEach((row: number[], r: number) => {
        row.forEach((cell: number, c: number) => {
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
    }

    // CURRENT
    ctx.fillStyle = figureColors[current.type];

    current.shape.forEach((row: number[], r: number) => {
      row.forEach((cell: number, c: number) => {
        if (cell) {
          ctx.fillRect(
            (current.x + c) * cellSize,
            (current.y + r) * cellSize + offsetY,
            cellSize,
            cellSize
          );
        }
      });
    });

    // GAME OVER
    if (gameState.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${cellSize * 1.2}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    }
  }, [gameState, cellSize]);

  return <canvas ref={canvasRef} />;
};

export default GameBoard;