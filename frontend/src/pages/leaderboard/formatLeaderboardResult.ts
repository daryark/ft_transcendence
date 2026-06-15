export type LeaderboardResultMode = "fortyLines" | "quick" | "blitz";

const numberFormatter = new Intl.NumberFormat();

const formatDuration = (milliseconds: number) => {
  const safeMilliseconds = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(safeMilliseconds / 60_000);
  const seconds = Math.floor((safeMilliseconds % 60_000) / 1_000);
  const remainder = safeMilliseconds % 1_000;

  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
};

export const formatLeaderboardResult = (
  mode: LeaderboardResultMode,
  score: number,
) => {
  if (mode === "fortyLines") return formatDuration(score);
  if (mode === "quick") return `${numberFormatter.format(score)} m`;
  return `${numberFormatter.format(score)} pts`;
};
