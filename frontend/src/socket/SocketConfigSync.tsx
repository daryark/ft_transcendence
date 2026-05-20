import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  getSession,
  subscribeToSession,
  type SessionData,
} from "../auth/session";
import { saveGameConfig, type GameConfig } from "./gameConfigStorage";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

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

    const socket = io(SOCKET_URL, {
      auth: {
        token: session.token,
      },
      transports: ["websocket", "polling"],
    });

    socket.on("game:config", (config: GameConfig) => {
      saveGameConfig(config);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [session?.token]);

  return null;
}
