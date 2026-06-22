import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import {
  clearSession,
  saveSession,
  type SessionData,
} from "../../src/auth/session";

type Listener = (...args: unknown[]) => void;

const socketTestState = vi.hoisted(() => {
  const handlers = new Map<string, Listener[]>();
  const socket = {
    connected: true,
    on: vi.fn((event: string, listener: Listener) => {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
      return socket;
    }),
    off: vi.fn((event: string, listener: Listener) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((current) => current !== listener),
      );
      return socket;
    }),
  };

  return {
    handlers,
    socket,
    connectSocket: vi.fn(() => socket),
    disconnectSocket: vi.fn(),
  };
});

vi.mock("../../src/socket/socketClient", () => ({
  connectSocket: socketTestState.connectSocket,
  disconnectSocket: socketTestState.disconnectSocket,
  getSocket: vi.fn(() => socketTestState.socket),
  getSocketIdentityId: vi.fn(() => "42"),
  subscribeToSocket: vi.fn(() => () => undefined),
}));

const registeredSession: SessionData = {
  user: {
    id: 42,
    email: "player@example.com",
    username: "Player",
    created_at: null,
  },
  token: "registered-token",
};

function renderAt(pathname: string) {
  window.history.pushState({}, "", pathname);
  return render(<App />);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  clearSession();
  socketTestState.handlers.clear();
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/auth/me") {
        return Promise.resolve(
          new Response(JSON.stringify({ user: registeredSession.user }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        );
      }

      if (url === "/api/users/Player/miniprofile") {
        return Promise.resolve(
          new Response(JSON.stringify({ miniprofile: { level: 3 } }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        );
      }

      return Promise.resolve(new Response("{}", { status: 200 }));
    }),
  );

  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn(() => Promise.resolve()),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  clearSession();
  vi.unstubAllGlobals();
});

describe("App route integration", () => {
  it("redirects protected routes to auth when no session exists", async () => {
    renderAt("/play");

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
    expect(socketTestState.disconnectSocket).toHaveBeenCalled();
  });

  it("creates an anonymous session and enters the play menu from auth", async () => {
    renderAt("/");

    fireEvent.click(
      await screen.findByRole("button", { name: "Play as anonymous" }),
    );

    expect(
      await screen.findByRole("link", { name: /multiplayer/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solo/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/play");
    expect(socketTestState.connectSocket).toHaveBeenCalledWith(
      undefined,
      expect.stringMatching(/^GUEST-/),
    );
  });

  it("validates registered sessions before rendering protected content", async () => {
    saveSession(registeredSession);

    renderAt("/play");

    expect(
      await screen.findByRole("link", { name: /multiplayer/i }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/users/Player/miniprofile",
        expect.any(Object),
      );
    });
    expect(socketTestState.connectSocket).toHaveBeenCalledWith(
      "registered-token",
      "Player",
    );
  });
});
