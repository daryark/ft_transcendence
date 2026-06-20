import type { GameStats } from "./types";

type QuickGameOverProps = {
  onAgain: () => void;
  onExit: () => void;
  onSendToChat: () => void;
  quickplay?: {
    meters: number;
    floor: number;
    floorName?: string;
    previousBestMeters: number | null;
    isPersonalBest: boolean;
  };
  stats: GameStats;
};

export default function QuickGameOver({
  onAgain,
  onExit,
  onSendToChat,
  quickplay,
  stats,
}: QuickGameOverProps) {
  const altitude = quickplay?.meters ?? stats.lines + stats.piecesPlaced / 100;
  const previousBest = quickplay?.previousBestMeters;

  return (
    <main className="solo-game quick-results">
      <header className="quick-game__topbar">
        <h1>QUICK PLAY</h1>
        <button className="quick-results__exit" onClick={onExit} type="button">
          EXIT
        </button>
      </header>

      <section className="quick-results__panel" aria-label="Quick Play results">
        <div className="quick-results__spectate">QUICK PLAY</div>
        <div className="quick-results__kicker">YOUR FINAL ALTITUDE</div>
        <div className="quick-results__altitude-box">
          <strong className="quick-results__altitude">
            {altitude.toFixed(1)}M
          </strong>
        </div>
        <div className="quick-results__best">
          {quickplay?.isPersonalBest ? (
            <strong>NEW PERSONAL BEST</strong>
          ) : previousBest !== null && previousBest !== undefined ? (
            <span>PERSONAL BEST {previousBest.toFixed(1)}M</span>
          ) : (
            <span>NO SAVED PERSONAL BEST</span>
          )}
        </div>
      </section>

      <div className="quick-results__share">
        <span>
          REPLAY ID: R:{Math.round(altitude * 1000).toString(16).toUpperCase()}
        </span>
        <button onClick={onSendToChat} type="button">
          SEND TO CHAT
        </button>
      </div>

      <button className="quick-results__again" onClick={onAgain} type="button">
        AGAIN
      </button>

      <section className="quick-results__stats" aria-label="Run stats">
        <h2>STATS</h2>
        <div>
          <span>FLOOR</span>
          <strong>{quickplay?.floorName ?? quickplay?.floor ?? 1}</strong>
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
