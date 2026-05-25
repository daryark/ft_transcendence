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

let socket: Socket | null = null;

export const connectSocket = (token?: string) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: token ? { token } : {},
      transports: ["websocket", "polling"],
    });
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
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
      return undefined;
    }

    const socket = connectSocket(session.token);

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
