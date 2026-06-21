import { useEffect, useState } from "react";
import { apiJson } from "../../../api/client";
import { getSessionUser } from "../../../auth/session";
import {
  getModeLabel,
  getResultBanner,
  getResultObjectiveStat,
} from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";

type SoloResultsViewProps = {
  session: GameSession;
};

type ProfileResponse = {
  modes?: {
    fortyLines?: {
      value?: string | null;
    } | null;
  };
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

const parseResultTime = (value: string | null | undefined) => {
  if (!value) return null;

  const match = value.trim().match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const milliseconds = Number((match[3] ?? "0").padEnd(3, "0"));

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  return minutes * 60_000 + seconds * 1000 + milliseconds;
};

const formatPreciseRunTime = (milliseconds: number) => {
  const safeMilliseconds = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(safeMilliseconds / 60_000);
  const seconds = Math.floor((safeMilliseconds % 60_000) / 1000);
  const millis = safeMilliseconds % 1000;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(3, "0")}`;
};

export default function SoloResultsView({
  session,
}: SoloResultsViewProps) {
  const { gameConfig, result } = session;
  const [isFortyLinesPersonalBest, setIsFortyLinesPersonalBest] = useState(false);
  const isSoloResult = gameConfig?.mode === "solo" && Boolean(result);
  const isCompletedObjective = result?.reason === "objective_complete";
  const isSimpleObjectiveMode =
    gameConfig?.mode === "solo" &&
    (gameConfig.preset === "40Lines" || gameConfig.preset === "blitz");
  const shouldShowRetryMenu = isSimpleObjectiveMode && !isCompletedObjective;
  const shouldShowFortyLinesComplete =
    gameConfig?.mode === "solo" &&
    gameConfig.preset === "40Lines" &&
    isCompletedObjective;

  useEffect(() => {
    if (!shouldShowFortyLinesComplete) {
      return;
    }

    const user = getSessionUser();
    if (!user || user.isAnonymous) {
      return;
    }

    const controller = new AbortController();

    void apiJson<unknown>(
      `/api/users/${encodeURIComponent(user.username)}/profile`,
      { signal: controller.signal },
    )
      .then((data) => {
        const profile = normalizeProfile(data);
        const profileBestMs = parseResultTime(profile.modes?.fortyLines?.value);

        setIsFortyLinesPersonalBest(
          profileBestMs === null ||
            (result?.stats.elapsedMs ?? Number.POSITIVE_INFINITY) <= profileBestMs + 5,
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setIsFortyLinesPersonalBest(false);
        }
      });

    return () => controller.abort();
  }, [result?.stats.elapsedMs, shouldShowFortyLinesComplete]);

  if (!isSoloResult || gameConfig?.mode !== "solo" || !result) return null;

  const modeLabel = getModeLabel(gameConfig);
  const objectiveStat = getResultObjectiveStat(
    result.stats,
    gameConfig.objective.key,
  );

  if (shouldShowRetryMenu) {
    return (
      <main className="solo-game solo-game--results solo-game--retry-menu">
        <nav
          className="solo-game-results__retry-menu"
          aria-label="Run ended actions"
        >
          <button
            className="solo-game-results__menu-button"
            onClick={session.restartSolo}
            type="button"
          >
            RETRY
          </button>
          <button
            className="solo-game-results__menu-button"
            onClick={session.leaveResults}
            type="button"
          >
            BACK TO TITLE
          </button>
        </nav>
      </main>
    );
  }

  if (shouldShowFortyLinesComplete) {
    return (
      <main className="solo-game solo-game--forty-complete">
        <header className="forty-results__topbar">
          <h1>RESULTS</h1>
        </header>

        <section className="forty-results__panel" aria-label="40 Lines result">
          <span className="forty-results__label">FINAL TIME</span>
          <strong className="forty-results__time">
            {formatPreciseRunTime(result.stats.elapsedMs)}
          </strong>
          {isFortyLinesPersonalBest && (
            <div className="forty-results__personal-best">PERSONAL BEST</div>
          )}
        </section>

        <button
          className="forty-results__again"
          onClick={session.restartSolo}
          type="button"
        >
          AGAIN
        </button>
      </main>
    );
  }

  return (
    <main className="solo-game solo-game--results">
      {!(isSimpleObjectiveMode && isCompletedObjective) && (
        <header className="solo-game-results__top">
          <h1>RESULTS</h1>
          <div className="solo-game-results__status">
            <span>GAME</span>
            <strong>{session.connectionStatus}</strong>
          </div>
          <button
            className="solo-game-results__back"
            onClick={session.leaveResults}
            type="button"
          >
            BACK
          </button>
        </header>
      )}

      {!(isSimpleObjectiveMode && isCompletedObjective) && (
        <section
          className="solo-game-results__card"
          aria-label={`${modeLabel} results`}
        >
          <span className="solo-game-results__eyebrow">
            {objectiveStat.label}
          </span>
          <strong className="solo-game-results__time">
            {objectiveStat.value}
          </strong>
          <div className="solo-game-results__banner">
            {getResultBanner(
              result.reason,
              gameConfig.objective,
              modeLabel,
            )}
          </div>
          <div className="solo-game-results__stats">
            <div>
              <span>LINES</span>
              <strong>{result.stats.lines}</strong>
            </div>
            <div>
              <span>SCORE</span>
              <strong>{result.stats.score}</strong>
            </div>
            <div>
              <span>ROUND</span>
              <strong>{result.stats.round}</strong>
            </div>
          </div>
        </section>
      )}

      {gameConfig.preset !== "zen" && (
        <nav
          className="solo-game-results__actions"
          aria-label="Result actions"
        >
          <button
            className="solo-game-results__again"
            onClick={session.restartSolo}
            type="button"
          >
            AGAIN
          </button>
          {isSimpleObjectiveMode && isCompletedObjective && (
            <button
              className="solo-game-results__back"
              onClick={session.leaveResults}
              type="button"
            >
              BACK
            </button>
          )}
        </nav>
      )}
    </main>
  );
}
