import {
  getModeLabel,
  getResultBanner,
  getResultObjectiveStat,
} from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";

type SoloResultsViewProps = {
  session: GameSession;
};

export default function SoloResultsView({
  session,
}: SoloResultsViewProps) {
  const { gameConfig, result } = session;
  if (gameConfig?.mode !== "solo" || !result) return null;

  const modeLabel = getModeLabel(gameConfig);
  const objectiveStat = getResultObjectiveStat(
    result.stats,
    gameConfig.objective.key,
  );
  const isCompletedObjective = result.reason === "objective_complete";
  const isSimpleObjectiveMode =
    gameConfig.preset === "40Lines" || gameConfig.preset === "blitz";

  return (
    <main className="solo-game solo-game--results">
      {!(isSimpleObjectiveMode && isCompletedObjective) && (
        <header className="solo-game-results__top">
          <h1>RESULTS</h1>
          <div className="solo-game-results__status">
            <span>GAME</span>
            <strong>{session.connectionStatus}</strong>
          </div>
          <button
            className="solo-game-results__back"
            onClick={session.leaveResults}
            type="button"
          >
            BACK
          </button>
        </header>
      )}

      {!(isSimpleObjectiveMode && isCompletedObjective) && (
        <section
          className="solo-game-results__card"
          aria-label={`${modeLabel} results`}
        >
          <span className="solo-game-results__eyebrow">
            {objectiveStat.label}
          </span>
          <strong className="solo-game-results__time">
            {objectiveStat.value}
          </strong>
          <div className="solo-game-results__banner">
            {getResultBanner(
              result.reason,
              gameConfig.objective,
              modeLabel,
            )}
          </div>
          <div className="solo-game-results__stats">
            <div>
              <span>LINES</span>
              <strong>{result.stats.lines}</strong>
            </div>
            <div>
              <span>SCORE</span>
              <strong>{result.stats.score}</strong>
            </div>
            <div>
              <span>ROUND</span>
              <strong>{result.stats.round}</strong>
            </div>
          </div>
        </section>
      )}

      {gameConfig.preset !== "zen" && (
        <nav
          className="solo-game-results__actions"
          aria-label="Result actions"
        >
          <button
            className="solo-game-results__again"
            onClick={session.restartSolo}
            type="button"
          >
            AGAIN
          </button>
          {isSimpleObjectiveMode && isCompletedObjective && (
            <button
              className="solo-game-results__back"
              onClick={session.leaveResults}
              type="button"
            >
              BACK
            </button>
          )}
        </nav>
      )}
    </main>
  );
}
