import { useEffect, useMemo, useRef } from "react";
import type { Figure, GameState } from "../../pages/game/types";
import {
  boardCellFigureTypes,
  figureColors,
} from "../../pages/game/types";
import "./GameBoard.scss";

interface GameBoardProps {
  gameState: GameState;
  cellSize?: number;
  showGhost?: boolean;
}

const HIDDEN_ROWS = 2;

function shadeColor(color: string, amount: number) {
  const value = Number.parseInt(color.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const weight = Math.abs(amount);
  const red = value >> 16;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  const mix = (channel: number) =>
    Math.round(channel + (target - channel) * weight);

  return `rgb(${mix(red)}, ${mix(green)}, ${mix(blue)})`;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  cellSize: number,
  color: string,
  ghost = false,
) {
  const gap = cellSize >= 18 ? 1 : 0.5;
  const x = col * cellSize + gap;
  const y = row * cellSize + gap;
  const size = cellSize - gap * 2;

  if (ghost) {
    const lineWidth = Math.max(1, Math.round(cellSize * 0.055));

    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(
      x + lineWidth / 2,
      y + lineWidth / 2,
      size - lineWidth,
      size - lineWidth,
    );
    return;
  }

  ctx.fillStyle = shadeColor(color, -0.32);
  ctx.fillRect(x, y, size, size);

  const inset = Math.max(1, Math.round(cellSize * 0.055));
  const faceX = x + inset;
  const faceY = y + inset;
  const faceSize = size - inset * 2;
  const gradient = ctx.createLinearGradient(
    faceX,
    faceY,
    faceX + faceSize,
    faceY + faceSize,
  );

  gradient.addColorStop(0, shadeColor(color, 0.14));
  gradient.addColorStop(0.55, color);
  gradient.addColorStop(1, shadeColor(color, -0.12));
  ctx.fillStyle = gradient;
  ctx.fillRect(faceX, faceY, faceSize, faceSize);

  const edge = Math.max(1, Math.round(cellSize * 0.045));

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(faceX, faceY, faceSize, edge);
  ctx.fillRect(faceX, faceY, edge, faceSize);

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(faceX, faceY + faceSize - edge, faceSize, edge);
  ctx.fillRect(faceX + faceSize - edge, faceY, edge, faceSize);

  if (cellSize >= 18) {
    const highlightInset = Math.max(2, Math.round(cellSize * 0.17));

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + highlightInset,
      y + highlightInset,
      size - highlightInset * 2,
      size - highlightInset * 2,
    );
  }
}

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
  ghost = false,
) {
  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;

      const x = piece.x + colIndex;
      const y = piece.y + rowIndex + HIDDEN_ROWS;

      if (y < HIDDEN_ROWS) return;
      drawBlock(ctx, x, y, cellSize, color, ghost);
    });
  });
}

export default function GameBoard({
  gameState,
  cellSize = 30,
  showGhost = true,
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

        const figureType = boardCellFigureTypes[cell];

        const color = figureType
          ? figureColors[figureType]
          : "#58606f";

        drawBlock(
          ctx,
          colIndex,
          rowIndex + HIDDEN_ROWS,
          cellSize,
          color,
        );
      });
    });

    if (showGhost) {
      drawPiece(ctx, ghost, cellSize, figureColors[ghost.type], true);
    }
    drawPiece(ctx, current, cellSize, figureColors[current.type]);

    if (gameState.gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${cellSize}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    }
  }, [
    board,
    cellSize,
    current,
    gameState.gameOver,
    ghost,
    safeCols,
    safeRows,
    showGhost,
  ]);

  return (
    <canvas
      className="game-board"
      ref={canvasRef}
      width={safeCols * cellSize}
      height={(safeRows + HIDDEN_ROWS) * cellSize}
    />
  );
}
