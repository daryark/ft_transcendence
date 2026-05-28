import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { authFetch } from "../../auth/authFetch";

import "./Leaderboard.scss";

const leaderboardModes = ["fortyLines", "quick", "blitz"] as const;
const leaderboardScopes = ["global", "country", "friends"] as const;

type LeaderboardMode = (typeof leaderboardModes)[number];
type LeaderboardScope = (typeof leaderboardScopes)[number];

type Player = {
  id: number;
  name: string;
  score: number;
  country: string;
};

const isLeaderboardMode = (value?: string): value is LeaderboardMode =>
  !!value && leaderboardModes.includes(value as LeaderboardMode);

const isLeaderboardScope = (value?: string): value is LeaderboardScope =>
  !!value && leaderboardScopes.includes(value as LeaderboardScope);

const fetchLeaderboard = async (
  mode: LeaderboardMode,
  scope: LeaderboardScope,
) => {
  const res = await authFetch(
    `/api/leaderboards?mode=${encodeURIComponent(mode)}&scope=${encodeURIComponent(scope)}`,
  );

  if (!res.ok) {
    throw new Error("Failed to fetch leaderboard");
  }

  return res.json();
};

export default function Leaderboard() {
  const { mode, scope } = useParams<{
    mode: string;
    scope: string;
  }>();

  const navigate = useNavigate();

  const currentMode = isLeaderboardMode(mode) ? mode : "fortyLines";
  const currentScope = isLeaderboardScope(scope) ? scope : "global";

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // loading data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchLeaderboard(currentMode, currentScope);

        setPlayers(data);
      } catch {
        setError("Error loading leaderboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentMode, currentScope]);

  return (
    <div className="leaderboard">

      {/* MODE */}
      <div className="leaderboard__row">
        <button
          className={currentMode === "fortyLines" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/fortyLines/${currentScope}`)
          }
        >
          40 Lines
        </button>

        <button
          className={currentMode === "quick" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/quick/${currentScope}`)
          }
        >
          Quick
        </button>

        <button
          className={currentMode === "blitz" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/blitz/${currentScope}`)
          }
        >
          Blitz
        </button>
      </div>

      {/* SCOPE */}
      <div className="leaderboard__row">
        <button
          className={currentScope === "global" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/global`)
          }
        >
          World
        </button>

        <button
          className={currentScope === "country" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/country`)
          }
        >
          Country
        </button>

        <button
          className={currentScope === "friends" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/friends`)
          }
        >
          Friends
        </button>
      </div>

      {/* STATES */}
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}

      {/* TABLE */}
      {!loading && !error && (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Country</th>
              <th>Score</th>
            </tr>
          </thead>

          <tbody>
            {players.map((p, index) => (
              <tr key={p.id}>
                <td>{index + 1}</td>
                <td>{p.name}</td>
                <td>{p.country}</td>
                <td>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
