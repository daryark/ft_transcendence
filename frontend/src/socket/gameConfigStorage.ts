export type GameConfig = Record<string, unknown>;

export const GAME_CONFIG_STORAGE_KEY = "tetra-game-config";

export const saveGameConfig = (config: GameConfig) => {
  window.localStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify(config));
};

export const getStoredGameConfig = (): GameConfig | null => {
  try {
    const rawConfig = window.localStorage.getItem(GAME_CONFIG_STORAGE_KEY);

    return rawConfig ? (JSON.parse(rawConfig) as GameConfig) : null;
  } catch {
    return null;
  }
};
