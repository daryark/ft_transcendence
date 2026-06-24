import { describe, expect, it } from "vitest";
import { formatLeaderboardResult } from "../../src/pages/leaderboard/formatLeaderboardResult";

describe("leaderboard formatting", () => {
  it("formats forty lines scores as durations", () => {
    expect(formatLeaderboardResult("fortyLines", 65_432.4)).toBe("1:05.432");
    expect(formatLeaderboardResult("fortyLines", -100)).toBe("0:00.000");
  });

  it("formats quickplay meters and blitz points", () => {
    expect(formatLeaderboardResult("quick", 12345)).toBe("12,345 m");
    expect(formatLeaderboardResult("blitz", 987654)).toBe("987,654 pts");
  });
});
