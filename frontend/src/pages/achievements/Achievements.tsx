import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/client";
import BackButton from "../../components/BackButton/BackButton";
import { EmptyState, Skeleton } from "../../components/StateView/StateView";
import "./Achievements.scss";

type AchievementRarity = "common" | "rare" | "epic";

type Achievement = {
  id: number;
  code: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  target: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
};

type AchievementsResponse = {
  achievements: Achievement[];
};

const rarities: readonly AchievementRarity[] = ["common", "rare", "epic"];

const rarityLabels: Record<AchievementRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
};

function formatUnlockedAt(value: string | null) {
  if (!value) return "Locked";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [rarity, setRarity] = useState<AchievementRarity>("common");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void apiJson<AchievementsResponse>("/api/achievements", {
      signal: controller.signal,
    })
      .then((response) => {
        setAchievements(response.achievements);
        setError(null);
      })
      .catch((nextError: unknown) => {
        if (
          !(nextError instanceof DOMException && nextError.name === "AbortError")
        ) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Achievements could not be loaded.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  const visibleAchievements = useMemo(
    () =>
      achievements?.filter((achievement) => achievement.rarity === rarity) ?? [],
    [achievements, rarity],
  );
  const unlockedCount =
    achievements?.filter((achievement) => achievement.unlocked).length ?? 0;

  return (
    <main className="achievements-page">
      <BackButton />

      <section className="achievements-page__panel">
        <div className="achievements-page__heading">
          <div>
            <span>Tetra Channel</span>
            <h1>Achievements</h1>
          </div>
          <strong>
            {unlockedCount}/{achievements?.length ?? 28}
          </strong>
        </div>

        <div className="achievements-page__tabs" role="tablist">
          {rarities.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={rarity === item}
              className={rarity === item ? "active" : ""}
              onClick={() => setRarity(item)}
            >
              {rarityLabels[item]}
            </button>
          ))}
        </div>
      </section>

      {!achievements && !error && <Skeleton lines={6} />}
      {error && (
        <EmptyState title="ACHIEVEMENTS UNAVAILABLE" message={error} />
      )}

      {achievements && (
        <section className="achievements-grid" aria-label={`${rarity} achievements`}>
          {visibleAchievements.map((achievement) => {
            const progress = Math.min(achievement.progress, achievement.target);
            const progressPercent =
              achievement.target > 0
                ? Math.round((progress / achievement.target) * 100)
                : 0;

            return (
              <article
                className={`achievement-card achievement-card--${achievement.rarity} ${
                  achievement.unlocked ? "is-unlocked" : "is-locked"
                }`}
                key={achievement.code}
              >
                <div className="achievement-card__badge">
                  <span>{achievement.id}</span>
                </div>
                <div className="achievement-card__body">
                  <div className="achievement-card__title">
                    <h2>{achievement.name}</h2>
                    <span>{rarityLabels[achievement.rarity]}</span>
                  </div>
                  <p>{achievement.description}</p>
                  <div className="achievement-card__progress">
                    <span style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="achievement-card__meta">
                    <strong>
                      {achievement.unlocked
                        ? "Unlocked"
                        : `${progress} / ${achievement.target}`}
                    </strong>
                    <time dateTime={achievement.unlockedAt ?? undefined}>
                      {formatUnlockedAt(achievement.unlockedAt)}
                    </time>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
