import { useEffect, useState, type CSSProperties } from "react";
import GameBoard from "../../../components/GameBoard/GameBoard";
import {
  formatRunTime,
  getModeLabel,
  getObjectiveWarning,
} from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import GameCountdownOverlay from "../components/GameCountdownOverlay";
import GameFocusOverlay from "../components/GameFocusOverlay";
import GamePreviewPanel from "../components/GamePreviewPanel";
import LineClearToast from "../components/LineClearToast";

type SoloGameViewProps = {
  session: GameSession;
};

const TABLET_BREAKPOINT_PX = 860;
const SOLO_PACKAGE_SCALE_FLOOR = 0.74;
const SOLO_BASE_WIDTH_PX = 46 * 16;
const SOLO_BASE_HEIGHT_PX = 44 * 16;

function getSoloPackageScale() {
  if (window.innerWidth <= TABLET_BREAKPOINT_PX) {
    return SOLO_PACKAGE_SCALE_FLOOR;
  }

  const widthScale = (window.innerWidth - 64) / SOLO_BASE_WIDTH_PX;
  const heightScale = (window.innerHeight - 120) / SOLO_BASE_HEIGHT_PX;
  return Math.min(
    1,
    Math.max(SOLO_PACKAGE_SCALE_FLOOR, Math.min(widthScale, heightScale)),
  );
}

export default function SoloGameView({ session }: SoloGameViewProps) {
  const { gameConfig, gameState } = session;
  const [packageScale, setPackageScale] = useState(getSoloPackageScale);

  useEffect(() => {
    const updateScale = () => setPackageScale(getSoloPackageScale());

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (!gameState || gameConfig?.mode !== "solo") return null;

  const objective = gameConfig.objective;
  const stats = gameState.update;
  const isZen = gameConfig.preset === "zen";
  const targetLines =
    objective.winCondition === "lines"
      ? objective.linesToClear ?? 40
      : 40;
  const lineProgress =
    stats.objective?.type === "lines"
      ? `${stats.objective.current}/${stats.objective.target ?? targetLines}`
      : `${stats.lines}`;
  const primaryStat =
    objective.key === "score"
      ? { label: "SCORE", value: `${stats.score}` }
      : { label: "LINES", value: lineProgress };
  const objectiveWarning = getObjectiveWarning(objective, stats);
  const maxCellByHeight = Math.floor((window.innerHeight - 155) / gameState.rows);
  const cellSize = Math.max(8, Math.min(Math.round(32 * packageScale), maxCellByHeight));
  const previewFigureSize = Math.max(8, Math.round(cellSize * 0.94));
  const style = {
    "--solo-package-scale": String(packageScale),
  } as CSSProperties;

  return (
    <main className="solo-game" style={style}>
      <section className="solo-game__status" aria-label="Socket status">
        <div>
          <span className="solo-game__label">MODE</span>
          <strong>{getModeLabel(gameConfig)}</strong>
        </div>
        <div>
          <span className="solo-game__label">SOCKET</span>
          <strong>{session.connectionStatus}</strong>
        </div>
      </section>

      <section className="solo-game__stage">
        {gameConfig.controls.hold && (
          <GamePreviewPanel
            className="solo-game__panel solo-game__panel--hold"
            figureSize={previewFigureSize}
            state={gameState}
            type="hold"
          />
        )}

        {!isZen && (
          <aside className="solo-game__live-stats" aria-label="Run stats">
            <div>
              <span>PPS</span>
              <strong>{stats.piecesPerSecond.toFixed(2)}</strong>
              <small>PIECES/SECOND</small>
            </div>
            <div>
              <span>{primaryStat.label}</span>
              <strong>{primaryStat.value}</strong>
            </div>
            <div>
              <span>TIME</span>
              <strong>
                {formatRunTime(stats.remainingMs ?? stats.elapsedMs)}
              </strong>
            </div>
          </aside>
        )}

        <div className="solo-game__board-wrap">
          <LineClearToast
            event={stats.clearEvent}
            eventKey={gameState.piecesPlaced}
          />
          <GameBoard
            cellSize={cellSize}
            gameState={gameState}
            showGhost={gameConfig.controls.showShadowPiece}
          />
        </div>

        {gameConfig.controls.nextPieces > 0 && (
          <GamePreviewPanel
            className="solo-game__panel solo-game__panel--next"
            figureSize={previewFigureSize}
            nextCount={gameConfig.controls.nextPieces}
            state={gameState}
            type="next"
          />
        )}
      </section>

      {session.countdownStep && (
        <GameCountdownOverlay
          key={`countdown-${session.countdownStep}`}
          value={session.countdownStep}
          variant={
            session.countdownStep.length <= 2 ? "number" : undefined
          }
        />
      )}
      {!session.countdownStep && !session.result && objectiveWarning && (
        <GameCountdownOverlay
          key={`warning-${objectiveWarning}`}
          value={objectiveWarning}
          variant="warning"
        />
      )}

      <GameAbortOverlay progress={session.escProgress} />
      <GameFocusOverlay active={!session.focused && !session.result} />
    </main>
  );
}
