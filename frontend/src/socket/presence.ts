const PRESENCE_EVENT = "tetra-presence-change";

export type PresenceUpdate = {
  userId: number;
  username?: string;
  online: boolean;
};

const statuses = new Map<number, boolean>();

const emitPresenceChange = () => {
  window.dispatchEvent(new Event(PRESENCE_EVENT));
};

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const isUserOnline = (userId: number | string | null | undefined) => {
  const parsed = toPositiveInteger(userId);
  return parsed ? statuses.get(parsed) === true : false;
};

export const setUserPresence = (update: PresenceUpdate) => {
  const previous = statuses.get(update.userId) === true;
  statuses.set(update.userId, update.online);
  emitPresenceChange();

  return previous !== update.online;
};

export const setPresenceSnapshot = (
  updates: Array<{ userId: unknown; online: unknown }>,
) => {
  let changed = false;

  for (const update of updates) {
    const userId = toPositiveInteger(update.userId);
    if (!userId || typeof update.online !== "boolean") continue;

    const previous = statuses.get(userId) === true;
    statuses.set(userId, update.online);
    changed = changed || previous !== update.online;
  }

  if (changed) emitPresenceChange();
};

export const seedPresence = (updates: Array<{ userId: unknown; online: unknown }>) => {
  setPresenceSnapshot(updates);
};

export const subscribeToPresence = (callback: () => void) => {
  const listener = () => callback();
  window.addEventListener(PRESENCE_EVENT, listener);

  return () => {
    window.removeEventListener(PRESENCE_EVENT, listener);
  };
};
