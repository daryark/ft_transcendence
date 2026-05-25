import type { CSSProperties } from "react";
import type { Figure } from "../../pages/game/types";
import { figureColors } from "../../pages/game/types";
import "./MiniFigure.scss";

interface MiniFigureProps {
  figure: Figure;
  size?: number;
}

const GRID = 4;

export default function MiniFigure({ figure, size = 18 }: MiniFigureProps) {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  const offsetY = Math.max(0, Math.floor((GRID - figure.shape.length) / 2));
  const offsetX = Math.max(0, Math.floor((GRID - figure.shape[0].length) / 2));

  figure.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const y = rowIndex + offsetY;
      const x = colIndex + offsetX;

      if (cell && grid[y]?.[x] !== undefined) {
        grid[y][x] = 1;
      }
    });
  });

  return (
    <div className="mini-figure" aria-label={`${figure.type} piece preview`}>
      {grid.map((row, rowIndex) => (
        <div className="mini-figure__row" key={rowIndex}>
          {row.map((cell, colIndex) => (
            <span
              className="mini-figure__cell"
              key={`${rowIndex}-${colIndex}`}
              style={{
                "--cell-size": `${size}px`,
                "--cell-color": cell
                  ? figureColors[figure.type]
                  : "transparent",
              } as CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
