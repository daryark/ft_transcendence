import { useEffect, useState } from "react";
import {
  getSession,
  subscribeToSession,
  type SessionData,
} from "../auth/session";
import { saveGameConfig, type GameConfigDTO } from "./gameConfigStorage";
import { connectSocket, disconnectSocket } from "./socketClient";

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
    if (!session) {
      disconnectSocket();
      return undefined;
    }

    const socket = connectSocket(session.token);

    socket.on("game:config", (config: GameConfigDTO) => {
      saveGameConfig(config);
    });

    socket.on("connect_error", () => undefined);

    return () => {
      socket.off("game:config");
      socket.off("connect_error");
    };
  }, [session]);

  return null;
}
