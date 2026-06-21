import type { GameEndPayload, GameStats, VersusPlayerState } from "./types";
import { formatRunTime } from "./gameUtils";

type MultiplayerGameOverProps = {
  mode?: "custom" | "quickplay";
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
  mode,
  players,
  reason,
  stats,
  winnerId,
  onNext,
  modeLabel = "MULTIPLAYER",
}: MultiplayerGameOverProps) {
  const winner = winnerId ? players[String(winnerId)] : null;
  const playerList = Object.values(players).sort((a, b) => {
    if (winnerId && String(a.id) === String(winnerId)) return -1;
    if (winnerId && String(b.id) === String(winnerId)) return 1;

    const aStats = a.state?.update;
    const bStats = b.state?.update;

    return (bStats?.score ?? 0) - (aStats?.score ?? 0);
  });
  const winnerStats = winner?.state?.update ?? stats;
  const summaryStats = [
    ["PLAYERS", Object.keys(players).length],
    ["LINES", winnerStats.lines],
    ["SCORE", winnerStats.score],
    ["PIECES PER SECOND", winnerStats.piecesPerSecond.toFixed(2)],
    ["PIECES PLACED", winnerStats.piecesPlaced],
    ["ROUND", winnerStats.round],
  ] as const;

  if (mode === "custom") {
    return (
      <main className="solo-game custom-results">
        <header className="custom-results__topbar">
          <h1>RESULTS</h1>
        </header>

        <section className="custom-results__wrap" aria-label={`${modeLabel} results`}>
          <article className="custom-results__summary">
            <div className="custom-results__winner-rank">
              <span>No</span>
              <strong>1</strong>
            </div>
            <div className="custom-results__summary-grid">
              {summaryStats.map(([label, value]) => (
                <div className="custom-results__summary-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>

          <ol className="custom-results__players" aria-label="Player standings">
            {playerList.map((player, index) => {
              const playerStats = player.state?.update;
              const isWinner = winnerId && String(player.id) === String(winnerId);
              const status = isWinner
                ? "SURVIVOR"
                : player.gameOver || player.state?.gameOver
                  ? formatRunTime(playerStats?.elapsedMs ?? stats.elapsedMs)
                  : reason === "manual_exit"
                    ? "LEFT"
                    : "ENDED";

              return (
                <li
                  className={`custom-results__player${isWinner ? " is-winner" : ""}`}
                  key={String(player.id)}
                >
                  <div className="custom-results__player-rank">
                    <span>No</span>
                    <strong>{index + 1}</strong>
                  </div>
                  <div className="custom-results__player-main">
                    <strong>{formatVersusName(player.username, `PLAYER ${index + 1}`)}</strong>
                    <span>
                      {(playerStats?.lines ?? 0).toLocaleString()} lines /{" "}
                      {(playerStats?.piecesPerSecond ?? 0).toFixed(2)} pps /{" "}
                      {(playerStats?.score ?? 0).toLocaleString()} score
                    </span>
                  </div>
                  <div className="custom-results__player-status">
                    <strong>{status}</strong>
                    <span>
                      {(playerStats?.piecesPlaced ?? 0).toLocaleString()} pieces
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <button className="custom-results__next" onClick={onNext} type="button">
          NEXT
        </button>

        <footer className="custom-results__footer">THE RESULTS ARE IN!</footer>
      </main>
    );
  }

  return (
    <main className="solo-game solo-game--results">
      <header className="solo-game-results__top">
        <h1>GAME OVER</h1>
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
