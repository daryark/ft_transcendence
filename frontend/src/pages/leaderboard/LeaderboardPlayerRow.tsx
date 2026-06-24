import {
  formatLeaderboardResult,
  type LeaderboardResultMode,
} from "./formatLeaderboardResult";

type LeaderboardPlayerRowProps = {
  mode: LeaderboardResultMode;
  rank: number;
  name: string;
  country: string;
  achievedAt: string | null;
  score: number;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatRecordDate = (value: string | null) => {
  if (!value) return "Record date unavailable";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Record date unavailable"
    : dateFormatter.format(date);
};

export default function LeaderboardPlayerRow({
  mode,
  rank,
  name,
  country,
  achievedAt,
  score,
}: LeaderboardPlayerRowProps) {
  return (
    <li className="leaderboard-player">
      <span className="leaderboard-player__rank" aria-label={`Rank ${rank}`}>
        <span aria-hidden="true">No.</span>
        {rank}
      </span>

      <div className="leaderboard-player__identity">
        <div className="leaderboard-player__name-line">
          <strong className="leaderboard-player__name">{name}</strong>
          <span className="leaderboard-player__country">
            {country || "Unknown country"}
          </span>
        </div>
        <time
          className="leaderboard-player__date"
          dateTime={achievedAt ?? undefined}
        >
          {formatRecordDate(achievedAt)}
        </time>
      </div>

      <strong className="leaderboard-player__score">
        {formatLeaderboardResult(mode, score)}
      </strong>
    </li>
  );
}
