import type { GameEndPayload, GameStats, VersusPlayerState } from "./types";

type MultiplayerGameOverProps = {
  connectionStatus: string;
  players: Record<string, VersusPlayerState>;
  reason: GameEndPayload["reason"];
  stats: GameStats;
  winnerId?: GameEndPayload["winnerId"];
  onNext: () => void;
  modeLabel?: string;
};

function formatVersusName(name: string | undefined, fallback: string) {
  const trimmed = name?.trim();

  if (!trimmed) return fallback;
  if (trimmed.length > 18 && trimmed.includes("-")) return fallback;
  if (trimmed.length > 18) return `${trimmed.slice(0, 15)}...`;

  return trimmed;
}

export default function MultiplayerGameOver({
  connectionStatus,
  players,
  reason,
  stats,
  winnerId,
  onNext,
  modeLabel = "MULTIPLAYER",
}: MultiplayerGameOverProps) {
  const winner = winnerId ? players[String(winnerId)] : null;

  return (
    <main className="solo-game solo-game--results">
      <header className="solo-game-results__top">
        <h1>GAME OVER</h1>
        <div className="solo-game-results__status">
          <span>SOCKET</span>
          <strong>{connectionStatus}</strong>
        </div>
      </header>

      <section className="solo-game-results__card" aria-label={`${modeLabel} results`}>
        <span className="solo-game-results__eyebrow">{modeLabel}</span>
        <strong className="solo-game-results__time solo-game-results__time--message">
          {winner ? `${formatVersusName(winner.username, "PLAYER")} WINS` : "ROUND ENDED"}
        </strong>

        <div className="solo-game-results__banner">
          {reason === "manual_exit" ? "MATCH STOPPED" : "GAME OVER"}
        </div>

        <div className="solo-game-results__stats">
          <div>
            <span>PLAYERS</span>
            <strong>{Object.keys(players).length}</strong>
          </div>
          <div>
            <span>LINES</span>
            <strong>{stats.lines}</strong>
          </div>
          <div>
            <span>SCORE</span>
            <strong>{stats.score}</strong>
          </div>
        </div>
      </section>

      <nav className="solo-game-results__actions" aria-label="Result actions">
        <button
          className="solo-game-results__again"
          onClick={onNext}
          type="button"
        >
          NEXT
        </button>
      </nav>
    </main>
  );
}
