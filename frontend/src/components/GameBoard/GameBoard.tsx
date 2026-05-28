import { useEffect, useMemo, useRef } from "react";
import type { Figure, GameState } from "../../pages/game/types";
import { figureColors } from "../../pages/game/types";
import "./GameBoard.scss";

interface GameBoardProps {
  gameState: GameState;
  cellSize?: number;
}

const HIDDEN_ROWS = 2;

function hasCollision(board: number[][], figure: Figure) {
  const width = board[0]?.length ?? 0;

  if (width === 0) {
    return true;
  }

  for (let rowIndex = 0; rowIndex < figure.shape.length; rowIndex += 1) {
    for (
      let colIndex = 0;
      colIndex < figure.shape[rowIndex].length;
      colIndex += 1
    ) {
      if (!figure.shape[rowIndex][colIndex]) continue;

      const x = figure.x + colIndex;
      const y = figure.y + rowIndex;

      if (y < 0) continue;
      if (
        x < 0 ||
        x >= width ||
        y >= board.length ||
        board[y]?.[x] !== 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function getGhost(board: number[][], current: Figure) {
  let ghost = { ...current };

  while (!hasCollision(board, { ...ghost, y: ghost.y + 1 })) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }

  return ghost;
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Figure,
  cellSize: number,
  color: string,
) {
  ctx.fillStyle = color;

  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;

      const x = piece.x + colIndex;
      const y = piece.y + rowIndex + HIDDEN_ROWS;

      if (y < HIDDEN_ROWS) return;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    });
  });
}

export default function GameBoard({
  gameState,
  cellSize = 30,
}: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { rows, cols, board, current } = gameState;
  const safeRows = Math.max(rows, board.length, 1);
  const safeCols = Math.max(cols, board[0]?.length ?? 0, 1);
  const ghost = useMemo(() => getGhost(board, current), [board, current]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = safeCols * cellSize;
    canvas.height = (safeRows + HIDDEN_ROWS) * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#08090f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    for (let row = HIDDEN_ROWS; row < safeRows + HIDDEN_ROWS; row += 1) {
      for (let col = 0; col < safeCols; col += 1) {
        ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    board.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell) return;

        ctx.fillStyle = "#58606f";
        ctx.fillRect(
          colIndex * cellSize,
          (rowIndex + HIDDEN_ROWS) * cellSize,
          cellSize,
          cellSize,
        );
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.strokeRect(
          colIndex * cellSize,
          (rowIndex + HIDDEN_ROWS) * cellSize,
          cellSize,
          cellSize,
        );
      });
    });

    ctx.globalAlpha = 0.22;
    drawPiece(ctx, ghost, cellSize, figureColors[ghost.type]);
    ctx.globalAlpha = 1;
    drawPiece(ctx, current, cellSize, figureColors[current.type]);

    if (gameState.gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${cellSize}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    }
  }, [board, cellSize, current, gameState.gameOver, ghost, safeCols, safeRows]);

  return (
    <canvas
      className="game-board"
      ref={canvasRef}
      width={safeCols * cellSize}
      height={(safeRows + HIDDEN_ROWS) * cellSize}
    />
  );
}
