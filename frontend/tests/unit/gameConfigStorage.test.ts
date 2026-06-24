import { beforeEach, describe, expect, it } from "vitest";
import {
  GAME_CONFIG_STORAGE_KEY,
  getStoredGameConfig,
  saveGameConfig,
  type GameConfigDTO,
} from "../../src/socket/gameConfigStorage";

const config: GameConfigDTO = {
  shared: {
    gameConfig: {
      general: { boardWidth: 10, boardHeight: 20 },
      controls: { hold: true, nextPieces: 5, showShadowPiece: true },
    },
  },
  solo: {
    presets: {
      "40lines": {
        label: "40 Lines",
        description: "Clear 40 lines",
        objective: { winCondition: "lines" },
      },
      zen: {
        label: "Zen",
        description: "Relax",
        objective: { winCondition: "none" },
      },
      blitz: {
        label: "Blitz",
        description: "Score",
        objective: { winCondition: "time" },
      },
    },
    roomRules: { anonymousAllowed: true },
  },
  multiplayer: {
    quickplay: {
      modifiers: ["no-hold"],
      roomRules: { anonymousAllowed: true },
    },
    custom: {
      editableConfig: {},
      publicRoomRules: { anonymousAllowed: false },
      privateRoomRules: { anonymousAllowed: true },
    },
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("game config storage", () => {
  it("saves and reads config DTOs from localStorage", () => {
    saveGameConfig(config);

    expect(window.localStorage.getItem(GAME_CONFIG_STORAGE_KEY)).toBe(
      JSON.stringify(config),
    );
    expect(getStoredGameConfig()).toEqual(config);
  });

  it("returns null for missing or invalid stored config JSON", () => {
    expect(getStoredGameConfig()).toBeNull();

    window.localStorage.setItem(GAME_CONFIG_STORAGE_KEY, "{broken");
    expect(getStoredGameConfig()).toBeNull();
  });
});
