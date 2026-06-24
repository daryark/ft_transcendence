import { describe, expect, it } from "vitest";
import type { GameConfig, ObjectiveConfig } from "../../shared/types/config.types";
import type { GameStats } from "../../src/pages/game/types";
import {
  COUNTDOWN_NUMBERS,
  formatPlayerName,
  formatRunTime,
  getCountdownSequence,
  getModeLabel,
  getObjectiveWarning,
  getResultBanner,
  getResultObjectiveStat,
  isMultiplayerPayload,
} from "../../src/pages/game/gameUtils";

const soloConfig = (preset: "40Lines" | "blitz" | "zen"): GameConfig =>
  ({
    mode: "solo",
    preset,
  }) as GameConfig;

const objectiveStats = (current: number, remaining?: number): GameStats =>
  ({
    score: 1234,
    lines: current,
    elapsedMs: 65_432,
    objective: {
      current,
      target: 40,
      remaining,
    },
  }) as GameStats;

describe("game utils", () => {
  it("builds countdown sequences by game mode", () => {
    expect(getCountdownSequence(soloConfig("40Lines"))).toEqual([
      "CLEAR 40 LINES!",
      ...COUNTDOWN_NUMBERS,
    ]);
    expect(getCountdownSequence(soloConfig("blitz"))).toEqual([
      "TWO-MINUTE BLITZ",
      ...COUNTDOWN_NUMBERS,
    ]);
    expect(getCountdownSequence({ mode: "quickplay" } as GameConfig)).toEqual([
      "READY",
      ...COUNTDOWN_NUMBERS,
    ]);
    expect(getCountdownSequence(null)).toEqual([]);
  });

  it("formats mode labels, runtime and player names", () => {
    expect(getModeLabel({ mode: "custom" } as GameConfig)).toBe("CUSTOM ROOM");
    expect(getModeLabel(soloConfig("zen"))).toBe("ZEN");
    expect(formatRunTime(65_432)).toBe("1:05.43");
    expect(formatRunTime(-1)).toBe("0:00.00");
    expect(formatPlayerName("  Alice  ", "P1")).toBe("Alice");
    expect(formatPlayerName("anonymous-player-123456", "P1")).toBe("P1");
    expect(formatPlayerName("VeryVeryLongPlayerName", "P1")).toBe(
      "VeryVeryLongPla...",
    );
  });

  it("detects multiplayer payloads by players map presence", () => {
    expect(isMultiplayerPayload({ players: {} })).toBe(true);
    expect(isMultiplayerPayload({ players: null })).toBe(false);
    expect(isMultiplayerPayload(null)).toBe(false);
  });

  it("emits objective warnings at line and time thresholds", () => {
    const lineObjective = { winCondition: "lines", linesToClear: 40 } as ObjectiveConfig;
    const timeObjective = { winCondition: "time" } as ObjectiveConfig;

    expect(getObjectiveWarning(lineObjective, objectiveStats(35))).toBe("5");
    expect(getObjectiveWarning(lineObjective, objectiveStats(20))).toBeNull();
    expect(getObjectiveWarning(timeObjective, objectiveStats(0, 9_100))).toBe("10");
    expect(getObjectiveWarning(timeObjective, objectiveStats(0, 11_000))).toBeNull();
  });

  it("formats result stats and banners by objective", () => {
    const stats = objectiveStats(40);

    expect(getResultObjectiveStat(stats, "score")).toEqual({
      label: "FINAL SCORE",
      value: "1234",
    });
    expect(getResultObjectiveStat(stats, "lines")).toEqual({
      label: "FINAL LINES",
      value: "40",
    });
    expect(getResultObjectiveStat(stats, "time")).toEqual({
      label: "FINAL TIME",
      value: "1:05.43",
    });
    expect(
      getResultBanner(
        "objective_complete",
        { winCondition: "lines", linesToClear: 20 } as ObjectiveConfig,
        "SOLO",
      ),
    ).toBe("20 LINES CLEAR");
    expect(getResultBanner("manual_exit", null, "SOLO")).toBe("RUN ENDED");
  });
});
