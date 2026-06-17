import type { GarbageQueueItem } from "../types";

type GameGarbageQueueProps = {
  queue?: GarbageQueueItem[];
  rows: number;
  cellSize: number;
  alwaysVisible?: boolean;
};

export default function GameGarbageQueue({
  queue = [],
  rows,
  cellSize,
  alwaysVisible = false,
}: GameGarbageQueueProps) {
  if (!alwaysVisible && queue.length === 0) return null;

  const totalLines = queue.reduce((sum, item) => sum + item.lines, 0);
  const safeRows = Math.max(1, rows);

  return (
    <div
      aria-label={`${totalLines} pending garbage lines`}
      className="game-garbage-queue"
      style={{ height: `${safeRows * cellSize}px` }}
    >
      <div className="game-garbage-queue__track">
        {queue.map((item) => {
          const height = Math.min(100, (item.lines / safeRows) * 100);

          return (
            <div
              className={`game-garbage-queue__segment game-garbage-queue__segment--${item.status}`}
              key={item.id}
              style={{ flexBasis: `${height}%` }}
              title={`${item.lines} garbage line${item.lines === 1 ? "" : "s"}`}
            />
          );
        })}
      </div>
    </div>
  );
}
