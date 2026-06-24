import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import { userCapabilities } from "../../auth/capabilities";
import { getSessionUser, subscribeToSession } from "../../auth/session";
import { apiJson } from "../../api/client";
import { EmptyState, Skeleton } from "../../components/StateView/StateView";
import LeaderboardPlayerRow from "./LeaderboardPlayerRow";

import "./Leaderboard.scss";
import BackButton from "../../components/BackButton/BackButton";

const leaderboardModes = ["fortyLines", "quick", "blitz"] as const;
const leaderboardScopes = ["global", "country", "friends"] as const;

type LeaderboardMode = (typeof leaderboardModes)[number];
type LeaderboardScope = (typeof leaderboardScopes)[number];

type Player = {
  id: number;
  name: string;
  score: number;
  country: string;
  achievedAt: string | null;
};

const isLeaderboardMode = (value?: string): value is LeaderboardMode =>
  !!value && leaderboardModes.includes(value as LeaderboardMode);

const isLeaderboardScope = (value?: string): value is LeaderboardScope =>
  !!value && leaderboardScopes.includes(value as LeaderboardScope);

const fetchLeaderboard = async (
  mode: LeaderboardMode,
  scope: LeaderboardScope,
  signal: AbortSignal,
) => {
  const data = await apiJson<unknown>(
    `/api/leaderboards?mode=${encodeURIComponent(mode)}&scope=${encodeURIComponent(scope)}`,
    { signal },
  );

  if (!Array.isArray(data)) {
    throw new Error("Leaderboard API returned invalid data");
  }

  return data.map((entry, index): Player => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid leaderboard entry ${index + 1}`);
    }
    const value = entry as Record<string, unknown>;
    if (
      typeof value.id !== "number" ||
      typeof value.name !== "string" ||
      typeof value.score !== "number" ||
      typeof value.country !== "string" ||
      (value.achievedAt !== null && typeof value.achievedAt !== "string")
    ) {
      throw new Error(`Invalid leaderboard entry ${index + 1}`);
    }
    return {
      id: value.id,
      name: value.name,
      score: value.score,
      country: value.country,
      achievedAt: value.achievedAt,
    };
  });
};

export default function Leaderboard() {
  const { mode, scope } = useParams<{
    mode: string;
    scope: string;
  }>();

  const navigate = useNavigate();
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const capabilities = userCapabilities(user);

  const currentMode = isLeaderboardMode(mode) ? mode : "fortyLines";
  const requestedScope = isLeaderboardScope(scope) ? scope : "global";
  const currentScope =
    requestedScope === "global" ||
    (requestedScope === "country" && capabilities.canUseCountryLeaderboards) ||
    (requestedScope === "friends" && capabilities.canUseFriends)
      ? requestedScope
      : "global";

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // loading data
  useEffect(() => {
    if (requestedScope !== currentScope) {
      navigate(`/channel/leaderboards/${currentMode}/${currentScope}`, {
        replace: true,
      });
    }
  }, [currentMode, currentScope, navigate, requestedScope]);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchLeaderboard(
          currentMode,
          currentScope,
          controller.signal,
        );

        setPlayers(data);
      } catch (nextError) {
        if (
          !(nextError instanceof DOMException && nextError.name === "AbortError")
        ) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Error loading leaderboard",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadData();
    return () => controller.abort();
  }, [currentMode, currentScope]);

  return (
    <div className="leaderboard">
      <BackButton to="/channel" />
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
          disabled={!capabilities.canUseCountryLeaderboards}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/country`)
          }
        >
          Country
        </button>

        <button
          className={currentScope === "friends" ? "active" : ""}
          disabled={!capabilities.canUseFriends}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/friends`)
          }
        >
          Friends
        </button>
      </div>

      {/* STATES */}
      {loading && <Skeleton lines={8} />}
      {error && (
        <EmptyState title="LEADERBOARD UNAVAILABLE" message={error} />
      )}

      {/* TABLE */}
      {!loading && !error && players.length === 0 && (
        <EmptyState
          title="NO SCORES YET"
          message="Complete a match to appear on this leaderboard."
        />
      )}

      {!loading && !error && players.length > 0 && (
        <ol className="leaderboard__list" aria-label="Leaderboard results">
          {players.map((player, index) => (
            <LeaderboardPlayerRow
              key={player.id}
              mode={currentMode}
              rank={index + 1}
              name={player.name}
              country={player.country}
              achievedAt={player.achievedAt}
              score={player.score}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
