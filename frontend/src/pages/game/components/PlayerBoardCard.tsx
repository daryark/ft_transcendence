import type { CSSProperties } from "react";
import GameBoard from "../../../components/GameBoard/GameBoard";
import type { ControlsConfig } from "../../../../shared/types/config.types";
import { formatPlayerName } from "../gameUtils";
import type { GameState } from "../types";
import GamePreviewPanel from "./GamePreviewPanel";

type PlayerBoardCardProps = {
  state: GameState;
  username?: string;
  fallbackName: string;
  modifier: "self" | "opponent";
  controls: ControlsConfig;
  scale?: number;
};

export default function PlayerBoardCard({
  state,
  username,
  fallbackName,
  modifier,
  controls,
  scale = 1,
}: PlayerBoardCardProps) {
  const cellSize = Math.round(26 * scale);
  const figureSize = Math.round(24 * scale);

  return (
    <article
      className={`versus-game__player versus-game__player--${modifier}`}
      style={
        { "--versus-card-scale": String(scale) } as CSSProperties
      }
    >
      {controls.hold ? (
        <GamePreviewPanel
          className="versus-game__side-panel versus-game__side-panel--hold"
          figureSize={figureSize}
          state={state}
          type="hold"
        />
      ) : (
        <div />
      )}

      <div className="versus-game__board-wrap">
        <GameBoard
          cellSize={cellSize}
          gameState={state}
          showGhost={controls.showShadowPiece}
        />
        <div className="versus-game__name">
          {formatPlayerName(username, fallbackName)}
        </div>
      </div>

      <div className="versus-game__queue-wrap">
        <GamePreviewPanel
          className="versus-game__side-panel versus-game__side-panel--next"
          figureSize={figureSize}
          nextCount={controls.nextPieces}
          state={state}
          type="next"
        />
        <div className="versus-game__stats">
          <span>LINES</span>
          <strong>{state.lines}</strong>
          <span>SCORE</span>
          <strong>{state.score}</strong>
        </div>
      </div>
    </article>
  );
}
