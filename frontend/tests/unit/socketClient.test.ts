import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (...args: unknown[]) => void;

const sockets: Array<{
  disconnect: ReturnType<typeof vi.fn>;
  emitEvent: (event: string, payload?: unknown) => void;
  handlers: Map<string, Listener[]>;
}> = [];

const ioMock = vi.fn(() => {
  const handlers = new Map<string, Listener[]>();
  const socket = {
    disconnect: vi.fn(),
    handlers,
    emitEvent: (event: string, payload?: unknown) => {
      for (const listener of handlers.get(event) ?? []) {
        listener(payload);
      }
    },
    on: vi.fn((event: string, listener: Listener) => {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
      return socket;
    }),
  };
  sockets.push(socket);
  return socket;
});

vi.mock("socket.io-client", () => ({ io: ioMock }));

async function loadSocketClient() {
  vi.resetModules();
  sockets.length = 0;
  ioMock.mockClear();
  return import("../../src/socket/socketClient");
}

beforeEach(() => {
  vi.resetModules();
});

describe("socket client", () => {
  it("opens one anonymous socket and reuses it for the same identity", async () => {
    const { connectSocket, getSocket } = await loadSocketClient();

    const first = connectSocket();
    const second = connectSocket();

    expect(second).toBe(first);
    expect(getSocket()).toBe(first);
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledWith(
      "/",
      expect.objectContaining({
        path: "/socket.io",
        auth: {},
        transports: ["websocket", "polling"],
      }),
    );
  });

  it("disconnects the previous socket when the token changes", async () => {
    const { connectSocket, getSocket } = await loadSocketClient();

    const first = connectSocket("token-a");
    const second = connectSocket("token-b", "PLAYER");

    expect(first).not.toBe(second);
    expect(sockets[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(getSocket()).toBe(second);
    expect(ioMock).toHaveBeenLastCalledWith(
      "/",
      expect.objectContaining({
        auth: { token: "token-b", username: "PLAYER" },
      }),
    );
  });

  it("tracks identity and connection errors through socket events", async () => {
    const { connectSocket, getSocketError, getSocketIdentityId } =
      await loadSocketClient();
    connectSocket("token-a");

    sockets[0]?.emitEvent("session:identity", { id: 123 });
    sockets[0]?.emitEvent("connect_error", { message: "boom" });
    expect(getSocketIdentityId()).toBe("123");
    expect(getSocketError()).toBe("boom");

    sockets[0]?.emitEvent("connect");
    expect(getSocketError()).toBeNull();
  });
});
