import { io, type Socket } from "socket.io-client";

// export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

export const SOCKET_URL ="/";


const SOCKET_EVENT = "tetra-socket-change";
const ANONYMOUS_SOCKET_KEY = "__anonymous__";

let socket: Socket | null = null;
let socketToken: string | null = null;
let socketIdentityId: string | null = null;
let socketError: string | null = null;

const emitSocketChange = () => {
  window.dispatchEvent(new Event(SOCKET_EVENT));
};

export const connectSocket = (token?: string, username?: string) => {
  const nextSocketToken = token ?? ANONYMOUS_SOCKET_KEY;

  if (socket && socketToken !== nextSocketToken) {
    socket.disconnect();
    socket = null;
    socketToken = null;
    socketIdentityId = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      auth: {
        ...(token ? { token } : {}),
        ...(username ? { username } : {}),
      },
      transports: ["websocket", "polling"],
    });
    socket.on("session:identity", (payload: { id?: unknown }) => {
      socketIdentityId =
        typeof payload?.id === "string" || typeof payload?.id === "number"
          ? String(payload.id)
          : null;
      emitSocketChange();
    });
    socket.on("connect", () => {
      socketError = null;
      emitSocketChange();
    });
    socket.on("disconnect", () => emitSocketChange());
    socket.on("connect_error", (error) => {
      socketError = error.message || "Unable to connect to the game server";
      emitSocketChange();
    });
    socketToken = nextSocketToken;
    emitSocketChange();
  }

  return socket;
};

export const getSocket = () => socket;

export const getSocketIdentityId = () => socketIdentityId;
export const getSocketError = () => socketError;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  socketToken = null;
  socketIdentityId = null;
  socketError = null;
  emitSocketChange();
};

export const subscribeToSocket = (callback: () => void) => {
  const listener = () => callback();

  window.addEventListener(SOCKET_EVENT, listener);

  return () => {
    window.removeEventListener(SOCKET_EVENT, listener);
  };
};
