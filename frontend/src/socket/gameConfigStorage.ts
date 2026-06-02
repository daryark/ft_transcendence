import type { ObjectiveConfig } from "../../shared/types/config.types";

export type SoloPresetKey = "40lines" | "zen" | "blitz";

export type SoloBackendPreset = "40Lines" | "zen" | "blitz";

export type GameConfigDTO = {
  shared: {
    gameConfig: {
      general: {
        boardWidth: number;
        boardHeight: number;
      };
      controls: {
        hold: boolean;
        nextPieces: number;
        showShadowPiece: boolean;
      };
    };
  };
  solo: {
    presets: Record<
      SoloPresetKey,
      {
        label: string;
        description: string;
        objective: Partial<ObjectiveConfig>;
      }
    >;
    roomRules: {
      anonymousAllowed: boolean;
      unrankedAllowed: boolean;
    };
  };
  multiplayer: {
    quickplay: {
      modifiers: string[];
      roomRules: {
        anonymousAllowed: boolean;
        unrankedAllowed: boolean;
      };
    };
    league: {
      requirements: {
        minimumLevel: number;
        placementMatches: number;
      };
      roomRules: {
        anonymousAllowed: boolean;
        unrankedAllowed: boolean;
      };
    };
    custom: {
      editableConfig: Record<string, unknown>;
      publicRoomRules: {
        anonymousAllowed: boolean;
        unrankedAllowed: boolean;
      };
      privateRoomRules: {
        anonymousAllowed: boolean;
        unrankedAllowed: boolean;
      };
    };
  };
};

export const GAME_CONFIG_STORAGE_KEY = "tetra-game-config";

export const saveGameConfig = (config: GameConfigDTO) => {
  window.localStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify(config));
};

export const getStoredGameConfig = (): GameConfigDTO | null => {
  try {
    const rawConfig = window.localStorage.getItem(GAME_CONFIG_STORAGE_KEY);

    return rawConfig ? (JSON.parse(rawConfig) as GameConfigDTO) : null;
  } catch {
    return null;
  }
};
