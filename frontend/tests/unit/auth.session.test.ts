import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionData, SessionUser } from "../../src/auth/session";

const user: SessionUser = {
  id: 42,
  email: "player@example.com",
  username: "PLAYER",
  created_at: null,
};

const anonymousUser: SessionUser = {
  id: 9001,
  email: "anonymous@local",
  username: "GUEST-TEST",
  created_at: "2026-01-01T00:00:00.000Z",
  isAnonymous: true,
};

async function loadSessionModule() {
  vi.resetModules();
  return import("../../src/auth/session");
}

function tokenWithExp(exp: number) {
  const payload = window
    .btoa(JSON.stringify({ exp }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `header.${payload}.signature`;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("auth session", () => {
  it("persists registered sessions in sessionStorage and emits changes", async () => {
    const { saveSession, subscribeToSession, getSession, getSessionToken } =
      await loadSessionModule();
    const listener = vi.fn();
    const unsubscribe = subscribeToSession(listener);
    const session: SessionData = { user, token: "token-1" };

    saveSession(session);

    expect(window.sessionStorage.getItem("tetra-session")).toEqual(
      JSON.stringify(session),
    );
    expect(window.localStorage.getItem("tetra-session")).toBeNull();
    expect(getSession()).toEqual(session);
    expect(getSessionToken()).toBe("token-1");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    saveSession({ user, token: "token-2" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps anonymous sessions separate from registered sessions", async () => {
    const { saveSession, getSessionUser } = await loadSessionModule();

    saveSession({ user: anonymousUser });

    expect(window.sessionStorage.getItem("tetra-anonymous-session")).toEqual(
      JSON.stringify({ user: anonymousUser }),
    );
    expect(window.sessionStorage.getItem("tetra-session")).toBeNull();
    expect(getSessionUser()).toEqual(anonymousUser);
  });

  it("drops expired registered sessions and falls back to anonymous recovery", async () => {
    const expiredSession: SessionData = {
      user,
      token: tokenWithExp(Math.floor(Date.now() / 1000) - 60),
    };
    const anonymousSession = { user: anonymousUser };
    window.sessionStorage.setItem("tetra-session", JSON.stringify(expiredSession));
    window.sessionStorage.setItem(
      "tetra-anonymous-session",
      JSON.stringify(anonymousSession),
    );

    const { initializeSession, getSessionUser } = await loadSessionModule();

    expect(initializeSession()).toEqual(anonymousSession);
    expect(getSessionUser()).toEqual(anonymousUser);
    expect(window.sessionStorage.getItem("tetra-session")).toBeNull();
  });

  it("creates anonymous users with guest identity shape", async () => {
    const { createAnonymousUser, createAnonymousSession } =
      await loadSessionModule();

    const createdUser = createAnonymousUser();
    const createdSession = createAnonymousSession();

    expect(createdUser).toMatchObject({
      email: "anonymous@local",
      isAnonymous: true,
    });
    expect(createdUser.username).toMatch(/^GUEST-[A-Z0-9]+$/);
    expect(createdSession.user.isAnonymous).toBe(true);
  });
});
