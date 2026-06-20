import type { GameStartPayload } from "./types";

export const ACTIVE_GAME_KEY = "tetra-active-game";

export type ActiveGamePayload = GameStartPayload & {
  from?: string;
  runStartedAt?: number;
};

export function toActiveGamePayload(
  value: unknown,
): Partial<ActiveGamePayload> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Partial<ActiveGamePayload>;
}

export function readStoredActiveGame(
  gameId?: string,
): Partial<ActiveGamePayload> | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);

    if (!raw) return null;

    const saved = toActiveGamePayload(JSON.parse(raw));

    if (!gameId || saved.roomId !== gameId) {
      window.sessionStorage.removeItem(ACTIVE_GAME_KEY);
      return null;
    }

    return saved;
  } catch {
    window.sessionStorage.removeItem(ACTIVE_GAME_KEY);
    return null;
  }
}

export function saveActiveGame(payload: Partial<ActiveGamePayload>) {
  try {
    const metadata = {
      roomId: payload.roomId,
      config: payload.config,
      from: payload.from,
      runStartedAt: payload.runStartedAt,
    };
    window.sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(metadata));
  } catch {
    // Persistence is optional; the active socket session can continue.
  }
}

export function clearStoredActiveGame(gameId?: string) {
  try {
    if (!gameId) {
      window.sessionStorage.removeItem(ACTIVE_GAME_KEY);
      return;
    }

    const raw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
    const saved = toActiveGamePayload(raw ? JSON.parse(raw) : null);

    if (!saved.roomId || saved.roomId === gameId) {
      window.sessionStorage.removeItem(ACTIVE_GAME_KEY);
    }
  } catch {
    window.sessionStorage.removeItem(ACTIVE_GAME_KEY);
  }
}

export function getReturnPath(locationState: unknown, gameId?: string) {
  const locationPath = toActiveGamePayload(locationState).from;

  if (locationPath && !locationPath.startsWith("/game/")) {
    return locationPath;
  }

  const saved = readStoredActiveGame(gameId);

  if (saved?.from && !saved.from.startsWith("/game/")) {
    return saved.from;
  }

  if (saved?.config?.mode === "quickplay") return "/play/multiplayer/quick";
  if (saved?.config?.mode === "custom") return "/play/multiplayer/custom";

  return "/play/solo/40lines";
}
