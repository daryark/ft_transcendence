import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadPresenceModule() {
  vi.resetModules();
  return import("../../src/socket/presence");
}

beforeEach(() => {
  vi.resetModules();
});

describe("presence store", () => {
  it("tracks online state only for positive integer user ids", async () => {
    const { isUserOnline, setPresenceSnapshot } = await loadPresenceModule();

    setPresenceSnapshot([
      { userId: 1, online: true },
      { userId: "2", online: true },
      { userId: 0, online: true },
      { userId: "abc", online: true },
      { userId: 3, online: "yes" },
    ]);

    expect(isUserOnline(1)).toBe(true);
    expect(isUserOnline("2")).toBe(true);
    expect(isUserOnline(0)).toBe(false);
    expect(isUserOnline("abc")).toBe(false);
    expect(isUserOnline(3)).toBe(false);
  });

  it("reports whether a direct presence update changed state", async () => {
    const { setUserPresence } = await loadPresenceModule();

    expect(setUserPresence({ userId: 7, online: false })).toBe(false);
    expect(setUserPresence({ userId: 7, online: true })).toBe(true);
    expect(setUserPresence({ userId: 7, online: true })).toBe(false);
    expect(setUserPresence({ userId: 7, online: false })).toBe(true);
  });

  it("notifies subscribers only while subscribed", async () => {
    const { setUserPresence, subscribeToPresence } = await loadPresenceModule();
    const listener = vi.fn();
    const unsubscribe = subscribeToPresence(listener);

    setUserPresence({ userId: 10, online: true });
    unsubscribe();
    setUserPresence({ userId: 10, online: false });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
