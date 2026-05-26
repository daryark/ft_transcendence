import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  getSession,
  subscribeToSession,
  type SessionData,
} from "../auth/session";
import { saveGameConfig, type GameConfig } from "./gameConfigStorage";

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

const SOCKET_EVENT = "tetra-socket-change";

let socket: Socket | null = null;
let socketToken: string | null = null;

const emitSocketChange = () => {
  window.dispatchEvent(new Event(SOCKET_EVENT));
};

export const connectSocket = (token?: string) => {
  if (!token) return null;

  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketToken = token;
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

export default function SocketConfigSync() {
  const [session, setSession] = useState<SessionData | null>(() =>
    getSession(),
  );

  useEffect(() => {
    return subscribeToSession(() => {
      setSession(getSession());
    });
  }, []);

  useEffect(() => {
    if (!session?.token) {
      disconnectSocket();
      return undefined;
    }

    const socket = connectSocket(session.token);
    if (!socket) return undefined;

    socket.on("game:config", (config: GameConfig) => {
      saveGameConfig(config);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    return () => {
      socket.off("game:config");
      socket.off("connect_error");
    };
  }, [session?.token]);

  return null;
}
