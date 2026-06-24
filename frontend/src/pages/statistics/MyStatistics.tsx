import { useEffect, useState, useSyncExternalStore } from "react";
import { apiJson } from "../../api/client";
import { getSessionUser, subscribeToSession } from "../../auth/session";
import BackButton from "../../components/BackButton/BackButton";
import { EmptyState, Skeleton } from "../../components/StateView/StateView";
import "./MyStatistics.scss";

const statisticModes = ["fortyLines", "blitz", "quickPlay"] as const;
type StatisticMode = (typeof statisticModes)[number];

type ModeStats = {
  value: string;
  achievedAgo?: string;
};

type TopGame = ModeStats & {
  achievedAt?: string | null;
};

type ProfileResponse = {
  modes?: Partial<Record<StatisticMode, ModeStats | null>>;
  topGames?: Partial<Record<StatisticMode, TopGame[]>>;
};

const modeLabels: Record<StatisticMode, string> = {
  fortyLines: "40 Lines",
  blitz: "Blitz",
  quickPlay: "Quick Game",
};

const normalizeProfile = (data: unknown): ProfileResponse => {
  if (!data || typeof data !== "object") return {};

  const value = data as Record<string, unknown>;
  const profile =
    value.profile && typeof value.profile === "object"
      ? (value.profile as Record<string, unknown>)
      : value;

  return profile as ProfileResponse;
};

export default function MyStatistics() {
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const [mode, setMode] = useState<StatisticMode>("fortyLines");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const controller = new AbortController();

    void apiJson<unknown>(
      `/api/users/${encodeURIComponent(user.username)}/profile`,
      { signal: controller.signal },
    )
      .then((data) => {
        setProfile(normalizeProfile(data));
        setError(null);
      })
      .catch((nextError: unknown) => {
        if (
          !(nextError instanceof DOMException && nextError.name === "AbortError")
        ) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Statistics could not be loaded.",
          );
        }
      });

    return () => controller.abort();
  }, [user]);

  const stats = profile?.modes?.[mode] ?? null;
  const topGames = profile?.topGames?.[mode] ?? (stats ? [stats] : []);

  return (
    <main className="my-statistics">
      <BackButton />

      <section className="my-statistics__panel">
        <h1>My Statistics</h1>
        <div className="my-statistics__tabs" role="tablist">
          {statisticModes.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              className={mode === item ? "active" : ""}
              onClick={() => setMode(item)}
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>
      </section>

      {!profile && !error && <Skeleton lines={1} />}
      {error && (
        <EmptyState title="STATISTICS UNAVAILABLE" message={error} />
      )}
      {profile && topGames.length === 0 && (
        <EmptyState
          title="NO RECORD YET"
          message={`Play ${modeLabels[mode]} to set your first record.`}
        />
      )}
      {topGames.length > 0 && (
        <section className="my-statistics__records" aria-label={`${modeLabels[mode]} top games`}>
          {topGames.slice(0, 10).map((game, index) => (
            <article className="my-statistics__record" key={`${mode}-${index}-${game.value}`}>
              <span className="my-statistics__rank">
                <small>No.</small>{index + 1}
              </span>
              <div>
                <strong>{modeLabels[mode]}</strong>
                <small>
                  {game.achievedAgo
                    ? `Achieved ${game.achievedAgo}`
                    : "Record date unavailable"}
                </small>
              </div>
              <strong className="my-statistics__value">{game.value}</strong>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
