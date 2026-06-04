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
    const handleGameConfig = (config: GameConfigDTO) => {
      saveGameConfig(config);
    };
    const handleConnectError = () => undefined;

    socket.on("game:config", handleGameConfig);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("game:config", handleGameConfig);
      socket.off("connect_error", handleConnectError);
    };
  }, [session]);

  return null;
}
