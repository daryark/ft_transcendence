import type { RoundEndPayload } from "../types";
import { formatPlayerName } from "../gameUtils";

type RoundResultOverlayProps = {
  result: RoundEndPayload | null;
};

export default function RoundResultOverlay({ result }: RoundResultOverlayProps) {
  if (!result) return null;

  const players = Object.values(result.players ?? {});
  const winner = result.winnerId
    ? result.players?.[String(result.winnerId)]
    : undefined;
  const isDuel = players.length <= 2;
  const title =
    result.label === "tiebreaker"
      ? "TIEBREAKER"
      : result.label === "match_point"
        ? "MATCH POINT"
        : "WINNER THIS ROUND";
  const labelClass = result.label ? ` round-result--${result.label}` : "";

  return (
    <div className={`round-result round-result--${isDuel ? "duel" : "multi"}${labelClass}`}>
      <div className="round-result__header">
        <span>ROUND {result.round}</span>
        <strong>{title}</strong>
      </div>

      {isDuel ? (
        <div className="round-result__duel">
          {players.map((player) => (
            <div
              className={`round-result__duel-side ${
                String(player.id) === String(result.winnerId)
                  ? "is-winner"
                  : ""
              }`}
              key={player.id}
            >
              <strong>{result.roundWins?.[String(player.id)] ?? 0}</strong>
              <span>{formatPlayerName(player.username, "PLAYER")}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="round-result__list">
          {players.map((player) => (
            <div
              className={`round-result__row ${
                String(player.id) === String(result.winnerId)
                  ? "is-winner"
                  : ""
              }`}
              key={player.id}
            >
              <span>{formatPlayerName(player.username, "PLAYER")}</span>
              <strong>{result.roundWins?.[String(player.id)] ?? 0}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="round-result__winner">
        {winner
          ? `${formatPlayerName(winner.username, "PLAYER")} WINS`
          : "ROUND ENDED"}
      </div>
    </div>
  );
}
