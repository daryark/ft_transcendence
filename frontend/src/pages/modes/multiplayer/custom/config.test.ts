import { describe, expect, it } from "vitest";
import type { GameConfigDTO } from "../../../../socket/gameConfigStorage";
import {
  createBackendConfigPatch,
  DEFAULT_CUSTOM_CONFIG,
  readCustomEditableConfig,
} from "./config";

describe("custom room config", () => {
  it("falls back safely when stored values have invalid types", () => {
    const storedConfig = {
      multiplayer: {
        custom: {
          editableConfig: {
            roomConfig: { public: "yes", maxPlayers: Number.NaN },
            matchConfig: { roundsToWin: "many" },
            gameConfig: {
              general: { boardWidth: "wide", boardHeight: 30 },
              controls: { hold: "yes" },
            },
          },
        },
      },
    } as unknown as GameConfigDTO;

    const result = readCustomEditableConfig(storedConfig);

    expect(result.roomConfig.public).toBe(true);
    expect(result.roomConfig.maxPlayers).toBeNull();
    expect(result.matchConfig?.roundsToWin).toBe(1);
    expect(result.gameConfig.general.boardWidth).toBe(10);
    expect(result.gameConfig.general.boardHeight).toBe(30);
    expect(result.gameConfig.controls.hold).toBe(true);
  });

  it("trims optional values before sending them to the backend", () => {
    const patch = createBackendConfigPatch(
      {
        ...DEFAULT_CUSTOM_CONFIG,
        roomConfig: {
          ...DEFAULT_CUSTOM_CONFIG.roomConfig,
          roomName: "  ROOM  ",
        },
      },
    );

    expect(patch.roomConfig?.roomName).toBe("ROOM");
    expect(patch.roomConfig).not.toHaveProperty("maxPlayers");
  });
});
