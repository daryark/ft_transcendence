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

type SoloGameViewProps = {
  session: GameSession;
};

export default function SoloGameView({ session }: SoloGameViewProps) {
  const { gameConfig, gameState } = session;
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

  return (
    <main className="solo-game">
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

        <GameBoard
          gameState={gameState}
          showGhost={gameConfig.controls.showShadowPiece}
        />

        <GamePreviewPanel
          className="solo-game__panel solo-game__panel--next"
          nextCount={gameConfig.controls.nextPieces}
          state={gameState}
          type="next"
        />
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
