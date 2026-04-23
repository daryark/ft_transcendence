import type { Figure } from "../../pages/game/figures";
import { figureColors } from "../../pages/game/figures";

type Props = {
  figure: Figure;
  //change size
  size?: number;
};

const GRID = 4;

export default function MiniFigure({ figure, size = 14 }: Props) {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(0));

  const offsetY = Math.floor((GRID - figure.shape.length) / 2);
  const offsetX = Math.floor((GRID - figure.shape[0].length) / 2);

  figure.shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) {
        const y = r + offsetY;
        const x = c + offsetX;
        if (grid[y] && grid[y][x] !== undefined) {
          grid[y][x] = 1;
        }
      }
    });
  });

  return (
    <div className="mini-wrapper">
      <div className="mini-figure">
        {grid.map((row, r) => (
          <div key={r} className="mini-row">
            {row.map((cell, c) => (
              <div
                key={c}
                style={{
                  width: size,
                  height: size,
                  background: cell ? figureColors[figure.type] : "transparent",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
