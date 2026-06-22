import { describe, expect, it } from "vitest";
import { ALL_MODES, getModesByPath } from "../../src/pages/play/data";

describe("play mode data", () => {
  it("returns exact mode groups for known routes", () => {
    expect(getModesByPath("/play")).toBe(ALL_MODES["/play"]);
    expect(getModesByPath("/play/multiplayer")).toBe(
      ALL_MODES["/play/multiplayer"],
    );
    expect(getModesByPath("/play/solo")).toBe(ALL_MODES["/play/solo"]);
  });

  it("maps nested mode URLs back to their section menu", () => {
    expect(getModesByPath("/play/multiplayer/quick")).toBe(
      ALL_MODES["/play/multiplayer"],
    );
    expect(getModesByPath("/play/solo/40lines")).toBe(ALL_MODES["/play/solo"]);
  });

  it("falls back to the main play menu for unknown paths", () => {
    expect(getModesByPath("/unknown")).toBe(ALL_MODES["/play"]);
  });
});
