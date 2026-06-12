import { io, type Socket } from "socket.io-client";

export const SOCKET_URL = "/";

const SOCKET_EVENT = "tetra-socket-change";
const ANONYMOUS_SOCKET_KEY = "__anonymous__";

let socket: Socket | null = null;
let socketToken: string | null = null;

const emitSocketChange = () => {
  window.dispatchEvent(new Event(SOCKET_EVENT));
};

export const connectSocket = (token?: string) => {
  const nextSocketToken = token ?? ANONYMOUS_SOCKET_KEY;

  if (socket && socketToken !== nextSocketToken) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      auth: {
        ...(token ? { token } : {}),
      },
      transports: ["websocket", "polling"],
    });
    socketToken = nextSocketToken;
    emitSocketChange();
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  socketToken = null;
  emitSocketChange();
};

export const subscribeToSocket = (callback: () => void) => {
  const listener = () => callback();

  window.addEventListener(SOCKET_EVENT, listener);

  return () => {
    window.removeEventListener(SOCKET_EVENT, listener);
  };
};
