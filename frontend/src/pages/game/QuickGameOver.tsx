import type { GameStats, QuickplayStats } from "./types";

type QuickGameOverProps = {
  onAgain: () => void;
  onExit: () => void;
  quickplay?: QuickplayStats;
  stats: GameStats;
};

export default function QuickGameOver({
  onAgain,
  onExit,
  quickplay,
  stats,
}: QuickGameOverProps) {
  const altitude = quickplay?.meters ?? stats.lines + stats.piecesPlaced / 100;

  return (
    <main className="solo-game quick-results">
      <header className="quick-game__topbar">
        <h1>QUICK PLAY</h1>
        <button className="quick-results__exit" onClick={onExit} type="button">
          EXIT
        </button>
      </header>

      <section className="quick-results__panel" aria-label="Quick Play results">
        <div className="quick-results__kicker">YOUR FINAL ALTITUDE</div>
        <strong className="quick-results__altitude">
          {altitude.toFixed(1)}M
        </strong>
      </section>

      <button className="quick-results__again" onClick={onAgain} type="button">
        AGAIN
      </button>

      <section className="quick-results__stats" aria-label="Run stats">
        <h2>STATS</h2>
        <div>
          <span>FLOOR</span>
          <strong>{quickplay?.floor ?? 1}</strong>
        </div>
        <div>
          <span>PIECES</span>
          <strong>{stats.piecesPlaced}</strong>
        </div>
        <div>
          <span>LINES</span>
          <strong>{stats.lines}</strong>
        </div>
        <div>
          <span>SCORE</span>
          <strong>{stats.score}</strong>
        </div>
      </section>
    </main>
  );
}
