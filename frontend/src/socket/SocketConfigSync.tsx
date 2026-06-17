import { useEffect, useState } from "react";
import {
  getSession,
  subscribeToSession,
  type SessionData,
} from "../auth/session";
import { saveGameConfig, type GameConfigDTO } from "./gameConfigStorage";
import { connectSocket, disconnectSocket } from "./socketClient";
import { useToast } from "../components/Toast/ToastProvider";
import type { AchievementToast } from "../components/Toast/ToastProvider";

export default function SocketConfigSync() {
  const { showAchievement, showToast } = useToast();
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

    const socket = connectSocket(session.token, session.user.username);
    const handleGameConfig = (config: GameConfigDTO) => {
      saveGameConfig(config);
    };
    const handleConnectError = (error: Error) => {
      showToast(
        error.message || "Unable to connect to the game server.",
        "error",
      );
    };
    const handleAchievementUnlocked = (achievement: AchievementToast) => {
      showAchievement(achievement);
    };
    const handleNotifications = (payload: unknown) => {
      const object = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      const notification =
        object.notification && typeof object.notification === "object"
          ? (object.notification as Record<string, unknown>)
          : object;
      const message = String(notification.title ?? notification.body ?? "New notification");

      if (message.trim()) {
        showToast(message, "info", () => {
          window.dispatchEvent(new CustomEvent("tetra:open-notifications"));
        });
      }
    };

    socket.on("game:config", handleGameConfig);
    socket.on("achievement:unlocked", handleAchievementUnlocked);
    socket.on("notifications", handleNotifications);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("game:config", handleGameConfig);
      socket.off("achievement:unlocked", handleAchievementUnlocked);
      socket.off("notifications", handleNotifications);
      socket.off("connect_error", handleConnectError);
    };
  }, [session, showAchievement, showToast]);

  return null;
}
