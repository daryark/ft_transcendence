import type { CSSProperties } from "react";
import type { Figure } from "../../pages/game/types";
import { figureColors } from "../../pages/game/types";
import "./MiniFigure.scss";

interface MiniFigureProps {
  figure: Figure;
  size?: number;
}

export default function MiniFigure({ figure, size = 38 }: MiniFigureProps) {
  return (
    <div className="mini-figure" aria-label={`${figure.type} piece preview`}>
      {figure.shape.map((row, rowIndex) => (
        <div className="mini-figure__row" key={rowIndex}>
          {row.map((cell, colIndex) => (
            <span
              className={`mini-figure__cell${
                cell ? " mini-figure__cell--filled" : ""
              }`}
              key={`${rowIndex}-${colIndex}`}
              style={{
                "--cell-size": `${size}px`,
                "--cell-inset": `${Math.max(1, size * 0.08)}px`,
                "--cell-color": figureColors[figure.type],
              } as CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
