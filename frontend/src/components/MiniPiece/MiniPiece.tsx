import type { Figure } from "../../pages/game/figures";

type Props = {
  piece: Figure;
};

export default function MiniPiece({ piece }: Props) {
  return (
    <div className="mini-piece">
      {piece.shape.map((row, r) => (
        <div key={r} className="mini-row">
          {row.map((cell, c) => (
            <div
              key={c}
              className={`mini-cell ${cell ? "filled" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}