import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_GAME_KEY,
  clearStoredActiveGame,
  readStoredActiveGame,
  saveActiveGame,
} from "./gameStorage";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("active game storage", () => {
  it("persists recovery metadata without storing board state", () => {
    saveActiveGame({
      roomId: "ROOM-1",
      from: "/play/multiplayer/custom",
      runStartedAt: 123,
      state: { board: [[1]] } as never,
      players: { player: {} } as never,
    });

    const raw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}")).toEqual({
      roomId: "ROOM-1",
      from: "/play/multiplayer/custom",
      runStartedAt: 123,
    });
  });

  it("removes stale metadata for a different room", () => {
    saveActiveGame({ roomId: "ROOM-1" });

    expect(readStoredActiveGame("ROOM-2")).toBeNull();
    expect(window.sessionStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it("does not clear another room's recovery metadata", () => {
    saveActiveGame({ roomId: "ROOM-1" });

    clearStoredActiveGame("ROOM-2");

    expect(readStoredActiveGame("ROOM-1")?.roomId).toBe("ROOM-1");
  });
});
