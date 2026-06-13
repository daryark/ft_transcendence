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

const MIN_VISIBLE_TOP_Y = -4;
const DANGER_STACK_RATIO = 0.8;
const SPAWN_Y = -3;
const EMPTY_BUFFER: number[][] = [];

function getBufferedCell(
  board: number[][],
  buffer: number[][],
  x: number,
  y: number,
) {
  if (y >= 0) return board[y]?.[x];

  const bufferIndex = buffer.length + y;
  return bufferIndex >= 0 ? buffer[bufferIndex]?.[x] : 0;
}

function hasCollision(
  board: number[][],
  buffer: number[][],
  figure: Figure,
) {
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

      if (
        x < 0 ||
        x >= width ||
        (buffer.length > 0 && y < -buffer.length) ||
        y >= board.length ||
        getBufferedCell(board, buffer, x, y) !== 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function getGhost(
  board: number[][],
  buffer: number[][],
  current: Figure,
) {
  let ghost = { ...current };

  while (
    !hasCollision(board, buffer, { ...ghost, y: ghost.y + 1 })
  ) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }

  return ghost;
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Figure,
  cellSize: number,
  color: string,
  topY: number,
) {
  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;

      const x = piece.x + colIndex;
      const y = piece.y + rowIndex - topY;

      if (y < 0) return;
      drawBlock(ctx, x, y, cellSize, color);
    });
  });
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  color: string,
) {
  const left = x * cellSize;
  const top = y * cellSize;
  const inset = Math.max(1, cellSize * 0.08);

  ctx.fillStyle = color;
  ctx.fillRect(left, top, cellSize, cellSize);

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(left + inset, top + inset, cellSize - inset * 2, inset);
  ctx.fillRect(left + inset, top + inset, inset, cellSize - inset * 2);

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(
    left + inset,
    top + cellSize - inset * 2,
    cellSize - inset * 2,
    inset,
  );
  ctx.fillRect(
    left + cellSize - inset * 2,
    top + inset,
    inset,
    cellSize - inset * 2,
  );

  ctx.strokeStyle = "rgba(0, 0, 0, 0.34)";
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, top + 0.5, cellSize - 1, cellSize - 1);
}

function drawDeathZone(
  ctx: CanvasRenderingContext2D,
  piece: Figure,
  cellSize: number,
  topY: number,
) {
  ctx.strokeStyle = "#ff3b30";
  ctx.lineWidth = Math.max(2, cellSize * 0.14);
  ctx.lineCap = "round";

  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;

      const x = piece.x + colIndex;
      const y = piece.y + rowIndex - topY;
      if (y < 0) return;

      const inset = cellSize * 0.22;
      const left = x * cellSize + inset;
      const right = (x + 1) * cellSize - inset;
      const top = y * cellSize + inset;
      const bottom = (y + 1) * cellSize - inset;

      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, bottom);
      ctx.moveTo(right, top);
      ctx.lineTo(left, bottom);
      ctx.stroke();
    });
  });

  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
}

export default function GameBoard({
  gameState,
  cellSize = 38,
  showGhost = true,
}: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { rows, cols, board, current, next } = gameState;
  const buffer = gameState.buffer ?? EMPTY_BUFFER;
  const safeRows = Math.max(rows, board.length, 1);
  const safeCols = Math.max(cols, board[0]?.length ?? 0, 1);
  const topY = useMemo(() => {
    let highestY = MIN_VISIBLE_TOP_Y;

    buffer.forEach((row, rowIndex) => {
      if (row.some((cell) => cell !== 0)) {
        highestY = Math.min(highestY, rowIndex - buffer.length);
      }
    });
    current.shape.forEach((row, rowIndex) => {
      if (row.some((cell) => cell !== 0)) {
        highestY = Math.min(highestY, current.y + rowIndex);
      }
    });

    return highestY;
  }, [buffer, current]);
  const ghost = useMemo(
    () => getGhost(board, buffer, current),
    [board, buffer, current],
  );
  const deathZonePiece = useMemo(() => {
    const nextPiece = next[0];
    if (!nextPiece) return null;

    return {
      ...nextPiece,
      x: Math.floor((safeCols - nextPiece.shape[0].length) / 2),
      y: SPAWN_Y,
    };
  }, [next, safeCols]);
  const showDeathZone = useMemo(() => {
    if (buffer.some((row) => row.some((cell) => cell !== 0))) {
      return true;
    }

    const highestOccupiedRow = board.findIndex((row) =>
      row.some((cell) => cell !== 0),
    );
    if (highestOccupiedRow < 0) return false;

    const stackHeight = safeRows - highestOccupiedRow;
    return stackHeight / safeRows >= DANGER_STACK_RATIO;
  }, [board, buffer, safeRows]);
  const canvasRows = safeRows - topY;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = safeCols * cellSize;
    canvas.height = canvasRows * cellSize;
    const visibleTop = -topY * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(2, 5, 6, 0.9)";
    ctx.fillRect(0, visibleTop, canvas.width, safeRows * cellSize);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.11)";
    ctx.lineWidth = 1;
    for (let row = -topY; row < canvasRows; row += 1) {
      for (let col = 0; col < safeCols; col += 1) {
        ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    buffer.forEach((row, rowIndex) => {
      const boardY = rowIndex - buffer.length;
      if (boardY < topY) return;

      row.forEach((cell, colIndex) => {
        if (!cell) return;

        const figureType = boardCellFigureTypes[cell];
        drawBlock(
          ctx,
          colIndex,
          boardY - topY,
          cellSize,
          figureType ? figureColors[figureType] : "#58606f",
        );
      });
    });

    board.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell) return;

        const figureType = boardCellFigureTypes[cell];

        drawBlock(
          ctx,
          colIndex,
          rowIndex - topY,
          cellSize,
          figureType ? figureColors[figureType] : "#58606f",
        );
      });
    });

    if (showGhost) {
      ctx.globalAlpha = 0.22;
      drawPiece(ctx, ghost, cellSize, figureColors[ghost.type], topY);
      ctx.globalAlpha = 1;
    }
    drawPiece(ctx, current, cellSize, figureColors[current.type], topY);

    if (showDeathZone && deathZonePiece) {
      drawDeathZone(ctx, deathZonePiece, cellSize, topY);
    }

    if (gameState.gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(0, visibleTop, canvas.width, safeRows * cellSize);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${cellSize}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(
        "GAME OVER",
        canvas.width / 2,
        visibleTop + (safeRows * cellSize) / 2,
      );
    }
  }, [
    board,
    buffer,
    canvasRows,
    cellSize,
    current,
    deathZonePiece,
    gameState.gameOver,
    ghost,
    safeCols,
    safeRows,
    showGhost,
    showDeathZone,
    topY,
  ]);

  return (
    <div
      className={`game-board${showDeathZone ? " game-board--danger" : ""}`}
      style={{
        aspectRatio: `${safeCols} / ${safeRows}`,
        width: `${safeCols * cellSize}px`,
        maxWidth: "92vw",
      }}
    >
      <canvas
        className="game-board__canvas"
        ref={canvasRef}
        width={safeCols * cellSize}
        height={canvasRows * cellSize}
      />
    </div>
  );
}
