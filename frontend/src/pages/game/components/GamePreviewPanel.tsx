import MiniFigure from "../../../components/MiniFigure/MiniFigure";
import type { GameState } from "../types";

type GamePreviewPanelProps = {
  state: GameState;
  type: "hold" | "next";
  nextCount?: number;
  figureSize?: number;
  className?: string;
};

export default function GamePreviewPanel({
  state,
  type,
  nextCount = 5,
  figureSize = 38,
  className = "",
}: GamePreviewPanelProps) {
  if (type === "hold") {
    return (
      <aside className={className}>
        <h2>HOLD</h2>
        <div className="solo-game__preview">
          {state.hold && <MiniFigure figure={state.hold} size={figureSize} />}
        </div>
      </aside>
    );
  }

  return (
    <aside className={className}>
      <h2>NEXT</h2>
      <div className="solo-game__next">
        {state.next.slice(0, nextCount).map((figure, index) => (
          <div
            className="solo-game__preview"
            key={`${figure.type}-${index}`}
          >
            <MiniFigure figure={figure} size={figureSize} />
          </div>
        ))}
      </div>
    </aside>
  );
}
