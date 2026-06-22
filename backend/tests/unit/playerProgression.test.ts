import { describe, expect, test } from "@jest/globals";
import {
  applyXpToLevel,
  calculateXpDelta,
  getLevelCapacity,
} from "../../game/services/playerProgression";

describe("player progression math", () => {
  test("level capacity is stable for fractional and low levels", () => {
    expect(getLevelCapacity(0)).toBe(getLevelCapacity(1));
    expect(getLevelCapacity(1.9)).toBe(getLevelCapacity(1));
    expect(getLevelCapacity(10)).toBeGreaterThan(getLevelCapacity(1));
  });

  test("calculates xp by mode and result", () => {
    expect(
      calculateXpDelta({ userId: 1, mode: "fortyLines", result: "win" }),
    ).toBe(300);
    expect(
      calculateXpDelta({ userId: 1, mode: "fortyLines", result: "lose" }),
    ).toBe(0);
    expect(
      calculateXpDelta({
        userId: 1,
        mode: "quickPlay",
        result: "lose",
        metricValue: 120,
      }),
    ).toBe(516);
    expect(
      calculateXpDelta({
        userId: 1,
        mode: "customGame",
        result: "win",
        elapsedMs: 200_000,
      }),
    ).toBe(500);
    expect(
      calculateXpDelta({
        userId: 1,
        mode: "customGame",
        result: "lose",
        elapsedMs: 10_000,
      }),
    ).toBe(144);
  });

  test("applies xp deltas across level boundaries", () => {
    const levelOneCapacity = getLevelCapacity(1);

    expect(applyXpToLevel(1, 10, 20)).toEqual({
      level: 1,
      xp: 30,
      nextLevelXp: levelOneCapacity,
    });
    expect(applyXpToLevel(1, levelOneCapacity - 10, 20)).toEqual({
      level: 2,
      xp: 10,
      nextLevelXp: getLevelCapacity(2),
    });
  });

  test("normalizes invalid level and xp inputs", () => {
    expect(applyXpToLevel(0, -100, -50)).toEqual({
      level: 1,
      xp: 0,
      nextLevelXp: getLevelCapacity(1),
    });
  });
});
