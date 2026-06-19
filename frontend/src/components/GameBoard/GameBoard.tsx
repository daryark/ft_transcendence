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
const LOCK_FX_MS = 240;
const CLEAR_FX_MS = 520;
const SCORE_FX_MS = 680;

type BoardFxCell = {
  x: number;
  y: number;
  color: string;
};

type BoardFx =
  | {
      id: number;
      type: "lock";
      startedAt: number;
      duration: number;
      cells: BoardFxCell[];
    }
  | {
      id: number;
      type: "clear";
      startedAt: number;
      duration: number;
      rows: number[];
      linesCleared: number;
    }
  | {
      id: number;
      type: "score";
      startedAt: number;
      duration: number;
      label: string;
      linesCleared: number;
    };

type BoardSnapshot = {
  board: number[][];
  buffer: number[][];
  current: Figure;
  piecesPlaced: number;
  lines: number;
  score: number;
  rows: number;
  cols: number;
};

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

function cloneFigure(figure: Figure): Figure {
  return {
    ...figure,
    shape: figure.shape.map((row) => [...row]),
  };
}

function createSnapshot(gameState: GameState): BoardSnapshot {
  return {
    board: gameState.board.map((row) => [...row]),
    buffer: (gameState.buffer ?? EMPTY_BUFFER).map((row) => [...row]),
    current: cloneFigure(gameState.current),
    piecesPlaced: gameState.piecesPlaced,
    lines: gameState.lines,
    score: gameState.score,
    rows: gameState.rows,
    cols: gameState.cols,
  };
}

function getPieceCells(snapshot: BoardSnapshot): BoardFxCell[] {
  const { current } = snapshot;
  const color = figureColors[current.type];
  const minY = -snapshot.buffer.length;

  return current.shape.flatMap((row, rowIndex) =>
    row.flatMap((cell, colIndex) => {
      if (!cell) return [];

      const x = current.x + colIndex;
      const y = current.y + rowIndex;
      if (x < 0 || x >= snapshot.cols || y < minY || y >= snapshot.rows) {
        return [];
      }

      return [{ x, y, color }];
    }),
  );
}

function getClearedRows(snapshot: BoardSnapshot, linesCleared: number) {
  const combined = [
    ...snapshot.buffer.map((row) => [...row]),
    ...snapshot.board.map((row) => [...row]),
  ];

  snapshot.current.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;

      const x = snapshot.current.x + colIndex;
      const y = snapshot.current.y + rowIndex;
      const combinedY = y + snapshot.buffer.length;
      if (
        x >= 0 &&
        x < snapshot.cols &&
        combinedY >= 0 &&
        combinedY < combined.length
      ) {
        combined[combinedY][x] = 1;
      }
    });
  });

  const rows = combined
    .map((row, index) => ({ index, row }))
    .filter(({ row }) => row.every((cell) => cell !== 0))
    .map(({ index }) => index - snapshot.buffer.length);

  if (rows.length > 0) {
    return rows;
  }

  return Array.from(
    { length: linesCleared },
    (_, index) => snapshot.rows - 1 - index,
  );
}

function getLineClearLabel(linesCleared: number) {
  switch (linesCleared) {
    case 1:
      return "SINGLE";
    case 2:
      return "DOUBLE";
    case 3:
      return "TRIPLE";
    case 4:
      return "TETRIS";
    default:
      return `${linesCleared} LINES`;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  options: { alpha?: number; glow?: number; scale?: number } = {},
) {
  const scale = options.scale ?? 1;
  const size = cellSize * scale;
  const offset = (cellSize - size) / 2;
  const left = x * cellSize + offset;
  const top = y * cellSize + offset;
  const inset = Math.max(1, cellSize * 0.08);

  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  if (options.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = cellSize * 0.34 * options.glow;
  }

  ctx.fillStyle = color;
  ctx.fillRect(left, top, size, size);

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(left + inset, top + inset, size - inset * 2, inset);
  ctx.fillRect(left + inset, top + inset, inset, size - inset * 2);

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(
    left + inset,
    top + size - inset * 2,
    size - inset * 2,
    inset,
  );
  ctx.fillRect(
    left + size - inset * 2,
    top + inset,
    inset,
    size - inset * 2,
  );

  ctx.strokeStyle = "rgba(0, 0, 0, 0.34)";
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, top + 0.5, size - 1, size - 1);
  ctx.restore();
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

function drawBoardFx(
  ctx: CanvasRenderingContext2D,
  effect: BoardFx,
  now: number,
  cellSize: number,
  topY: number,
  safeCols: number,
  canvasRows: number,
) {
  const progress = Math.min(1, Math.max(0, (now - effect.startedAt) / effect.duration));
  const easeOut = 1 - (1 - progress) ** 3;

  if (effect.type === "lock") {
    effect.cells.forEach((cell) => {
      const y = cell.y - topY;
      if (y < 0 || y >= canvasRows) return;

      drawBlock(ctx, cell.x, y, cellSize, cell.color, {
        alpha: Math.max(0, 0.7 - progress * 0.55),
        glow: 1 - progress,
        scale: 1 + easeOut * 0.28,
      });

      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.62 - progress * 0.62);
      ctx.strokeStyle = cell.color;
      ctx.lineWidth = Math.max(1, cellSize * (0.1 - progress * 0.05));
      ctx.strokeRect(
        cell.x * cellSize - cellSize * 0.18 * easeOut,
        y * cellSize - cellSize * 0.18 * easeOut,
        cellSize * (1 + easeOut * 0.36),
        cellSize * (1 + easeOut * 0.36),
      );
      ctx.restore();
    });
    return;
  }

  if (effect.type === "clear") {
    const flashAlpha = Math.max(0, 1 - progress);
    const sweepWidth = safeCols * cellSize * 0.34;
    const sweepX = -sweepWidth + (safeCols * cellSize + sweepWidth * 2) * easeOut;

    effect.rows.forEach((row) => {
      const y = row - topY;
      if (y < 0 || y >= canvasRows) return;

      const top = y * cellSize;
      const height = cellSize;

      ctx.save();
      ctx.globalAlpha = 0.72 * flashAlpha;
      ctx.fillStyle = effect.linesCleared >= 4 ? "#ffe45c" : "#ffffff";
      ctx.fillRect(0, top, safeCols * cellSize, height);
      ctx.globalAlpha = Math.max(0, 0.9 - progress);
      const gradient = ctx.createLinearGradient(
        sweepX,
        0,
        sweepX + sweepWidth,
        0,
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(sweepX, top, sweepWidth, height);
      ctx.restore();
    });
    return;
  }

  const x = safeCols * cellSize * 0.5;
  const y = Math.max(cellSize * 2, canvasRows * cellSize * 0.28 - easeOut * cellSize);

  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.max(13, cellSize * 0.78)}px monospace`;
  ctx.lineWidth = Math.max(3, cellSize * 0.12);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.84)";
  ctx.fillStyle = effect.linesCleared >= 4 ? "#ffe45c" : "#ffffff";
  ctx.strokeText(effect.label, x, y);
  ctx.fillText(effect.label, x, y);
  ctx.restore();
}

export default function GameBoard({
  gameState,
  cellSize = 38,
  showGhost = true,
}: GameBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousSnapshotRef = useRef<BoardSnapshot | null>(null);
  const effectsRef = useRef<BoardFx[]>([]);
  const effectIdRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const boardMotionRef = useRef<Animation | null>(null);
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
    if (prefersReducedMotion()) {
      previousSnapshotRef.current = createSnapshot(gameState);
      return;
    }

    const previousSnapshot = previousSnapshotRef.current;
    const currentSnapshot = createSnapshot(gameState);
    previousSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot) return;
    if (gameState.piecesPlaced <= previousSnapshot.piecesPlaced) return;

    const now = performance.now();
    const linesCleared = Math.max(
      0,
      gameState.update.linesCleared ?? gameState.lines - previousSnapshot.lines,
    );
    const scoreAdded = Math.max(
      0,
      gameState.update.scoreAdded ?? gameState.score - previousSnapshot.score,
    );
    const cells = getPieceCells(previousSnapshot);
    const nextEffects: BoardFx[] = [];

    if (cells.length > 0) {
      nextEffects.push({
        id: effectIdRef.current,
        type: "lock",
        startedAt: now,
        duration: LOCK_FX_MS,
        cells,
      });
      effectIdRef.current += 1;
    }

    if (linesCleared > 0) {
      nextEffects.push({
        id: effectIdRef.current,
        type: "clear",
        startedAt: now,
        duration: CLEAR_FX_MS,
        rows: getClearedRows(previousSnapshot, linesCleared),
        linesCleared,
      });
      effectIdRef.current += 1;
    }

    if (scoreAdded > 0 || linesCleared > 1) {
      const lineLabel = linesCleared > 0 ? getLineClearLabel(linesCleared) : "";
      const scoreLabel = scoreAdded > 0 ? `+${scoreAdded}` : "";

      nextEffects.push({
        id: effectIdRef.current,
        type: "score",
        startedAt: now,
        duration: SCORE_FX_MS,
        label: [lineLabel, scoreLabel].filter(Boolean).join(" "),
        linesCleared,
      });
      effectIdRef.current += 1;
    }

    if (nextEffects.length === 0) return;

    effectsRef.current = [...effectsRef.current, ...nextEffects];
    const boardElement = boardRef.current;

    if (boardElement) {
      boardMotionRef.current?.cancel();
      boardMotionRef.current =
        linesCleared > 0
          ? boardElement.animate(
              [
                { transform: "translateX(0)" },
                { transform: "translateX(-0.2rem)", offset: 0.18 },
                { transform: "translateX(0.24rem)", offset: 0.36 },
                { transform: "translateX(-0.12rem)", offset: 0.54 },
                { transform: "translateX(0)" },
              ],
              {
                duration: 360,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            )
          : boardElement.animate(
              [
                { transform: "translateY(0) scale(1)" },
                {
                  transform: "translateY(0.16rem) scale(0.996)",
                  offset: 0.35,
                },
                { transform: "translateY(0) scale(1)" },
              ],
              { duration: 160, easing: "ease-out" },
            );
      boardMotionRef.current.onfinish = () => {
        boardMotionRef.current = null;
      };
    }
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      boardMotionRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = safeCols * cellSize;
    canvas.height = canvasRows * cellSize;

    const drawFrame = (now: number) => {
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

      effectsRef.current.forEach((effect) => {
        drawBoardFx(
          ctx,
          effect,
          now,
          cellSize,
          topY,
          safeCols,
          canvasRows,
        );
      });

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
    };

    const drawAnimatedFrame = (now: number) => {
      effectsRef.current = effectsRef.current.filter(
        (effect) => now - effect.startedAt < effect.duration,
      );
      drawFrame(now);

      if (effectsRef.current.length > 0) {
        animationFrameRef.current = window.requestAnimationFrame(drawAnimatedFrame);
      } else {
        animationFrameRef.current = null;
      }
    };

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    drawFrame(performance.now());
    if (effectsRef.current.length > 0) {
      animationFrameRef.current = window.requestAnimationFrame(drawAnimatedFrame);
    } else {
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
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

  const className = [
    "game-board",
    showDeathZone ? "game-board--danger" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      ref={boardRef}
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
