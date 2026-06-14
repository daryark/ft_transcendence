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
};

export default function PlayerBoardCard({
  state,
  username,
  fallbackName,
  modifier,
  controls,
}: PlayerBoardCardProps) {
  return (
    <article
      className={`versus-game__player versus-game__player--${modifier}`}
    >
      {controls.hold ? (
        <GamePreviewPanel
          className="versus-game__side-panel versus-game__side-panel--hold"
          figureSize={24}
          state={state}
          type="hold"
        />
      ) : (
        <div />
      )}

      <div className="versus-game__board-wrap">
        <GameBoard
          cellSize={24}
          gameState={state}
          showGhost={controls.showShadowPiece}
        />
        <div className="versus-game__name">
          {formatPlayerName(username, fallbackName)}
        </div>
      </div>

      <div>
        <GamePreviewPanel
          className="versus-game__side-panel versus-game__side-panel--next"
          figureSize={24}
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
