import type {
  GameConfig,
  ObjectiveConfig,
} from "../../../shared/types/config.types";
import type {
  GameEndPayload,
  GameStats,
  GameStartPayload,
  VersusPlayerState,
} from "./types";

export const COUNTDOWN_NUMBERS = ["3", "2", "1", "GO"] as const;
export const TIME_WARNING_SECONDS = new Set([
  30, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
]);

export type CountdownStep =
  | "CLEAR 40 LINES!"
  | "TWO-MINUTE BLITZ"
  | "READY"
  | (typeof COUNTDOWN_NUMBERS)[number]
  | null;

export function isMultiplayerPayload(
  value: unknown,
): value is GameStartPayload & {
  players: Record<string, VersusPlayerState>;
} {
  return (
    !!value &&
    typeof value === "object" &&
    "players" in value &&
    !!(value as { players?: unknown }).players
  );
}

export function getCountdownSequence(
  config: GameConfig | null,
): CountdownStep[] {
  if (config?.mode && config.mode !== "solo") {
    return ["READY", ...COUNTDOWN_NUMBERS];
  }
  if (config?.mode !== "solo") return [];
  if (config.preset === "40Lines") {
    return ["CLEAR 40 LINES!", ...COUNTDOWN_NUMBERS];
  }
  if (config.preset === "blitz") {
    return ["TWO-MINUTE BLITZ", ...COUNTDOWN_NUMBERS];
  }

  return [];
}

export function getModeLabel(config: GameConfig | null) {
  if (config?.mode === "custom") return "CUSTOM ROOM";
  if (config?.mode === "quickplay") return "QUICK PLAY";
  if (config?.mode !== "solo") return "GAME";
  if (config.preset === "40Lines") return "40 LINES";
  if (config.preset === "blitz") return "BLITZ";
  if (config.preset === "zen") return "ZEN";

  return "SOLO";
}

export function formatRunTime(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const minutes = Math.floor(safeMilliseconds / 60000);
  const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
  const centiseconds = Math.floor((safeMilliseconds % 1000) / 10);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
}

export function formatPlayerName(
  name: string | undefined,
  fallback: string,
) {
  const trimmed = name?.trim();

  if (!trimmed) return fallback;
  if (trimmed.length > 18 && trimmed.includes("-")) return fallback;
  if (trimmed.length > 18) return `${trimmed.slice(0, 15)}...`;

  return trimmed;
}

export function getObjectiveWarning(
  objective: ObjectiveConfig | null,
  stats: GameStats | undefined,
) {
  if (!objective || !stats?.objective) return null;

  if (objective.winCondition === "time") {
    const remainingMs = stats.objective.remaining ?? stats.remainingMs;
    if (remainingMs === null || remainingMs <= 0) return null;

    const remainingSeconds = Math.ceil(remainingMs / 1000);
    return TIME_WARNING_SECONDS.has(remainingSeconds)
      ? `${remainingSeconds}`
      : null;
  }

  if (objective.winCondition === "lines") {
    const target = stats.objective.target ?? objective.linesToClear ?? null;
    if (!target) return null;

    const remaining = Math.max(0, target - stats.objective.current);
    const warnings = new Set([
      Math.ceil(target / 4),
      Math.ceil(target / 8),
      5,
      4,
      3,
      2,
      1,
    ]);

    return warnings.has(remaining) ? `${remaining}` : null;
  }

  return null;
}

export function getResultObjectiveStat(
  stats: GameStats,
  objectiveKey: ObjectiveConfig["key"] | undefined,
) {
  if (objectiveKey === "score") {
    return { label: "FINAL SCORE", value: `${stats.score}` };
  }
  if (objectiveKey === "lines") {
    return { label: "FINAL LINES", value: `${stats.lines}` };
  }

  return { label: "FINAL TIME", value: formatRunTime(stats.elapsedMs) };
}

export function getResultBanner(
  reason: GameEndPayload["reason"],
  objective: ObjectiveConfig | null,
  modeLabel: string,
) {
  if (reason !== "objective_complete") return "RUN ENDED";
  if (objective?.winCondition === "lines") {
    return `${objective.linesToClear ?? 40} LINES CLEAR`;
  }
  if (objective?.winCondition === "time") return "TIME UP";
  if (objective?.winCondition === "score") {
    return `${objective.scoreToWin ?? "TARGET"} SCORE`;
  }

  return `${modeLabel} COMPLETE`;
}
