import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getSession,
  subscribeToSession,
  type SessionData,
} from "../auth/session";
import { saveGameConfig, type GameConfigDTO } from "./gameConfigStorage";
import { connectSocket, disconnectSocket } from "./socketClient";
import { useToast } from "../components/Toast/ToastProvider";
import { clearStoredActiveGame } from "../pages/game/gameStorage";
import { setPresenceSnapshot, setUserPresence } from "./presence";

export default function SocketConfigSync() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
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
    const handleServerError = (payload: { reason?: string; message?: string }) => {
      if (payload.reason === "CLIENT_REPLACED") {
        clearStoredActiveGame();
        showToast(
          "CLIENT REPLACED: You joined this room on another client, replacing this one.",
          "error",
        );
        if (
          location.pathname.startsWith("/game/") ||
          location.pathname.startsWith("/play/multiplayer/custom/")
        ) {
          navigate("/play/multiplayer", { replace: true });
        }
      }
    };
    const handleNotifications = (payload: unknown) => {
      const object =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {};
      const notification =
        object.notification && typeof object.notification === "object"
          ? (object.notification as Record<string, unknown>)
          : object;
      const message = String(
        notification.title ?? notification.body ?? "New notification",
      );

      if (message.trim()) {
        showToast(message, "info", () => {
          window.dispatchEvent(new CustomEvent("tetra:open-notifications"));
        });
      }
    };
    const handleSocialUpdate = (payload: unknown) => {
      const object =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {};
      const action = String(object.action ?? "");

      if (action === "presence:snapshot" && Array.isArray(object.statuses)) {
        setPresenceSnapshot(
          object.statuses as Array<{ userId: unknown; online: unknown }>,
        );
        return;
      }

      if (action !== "presence") return;

      const userId = Number(object.userId);
      const online = object.online === true;
      if (!Number.isInteger(userId) || userId <= 0) return;

      const changed = setUserPresence({
        userId,
        username:
          typeof object.username === "string" ? object.username : undefined,
        online,
      });

      if (changed && online) {
        const username =
          typeof object.username === "string" && object.username.trim()
            ? object.username.trim()
            : "A friend";
        showToast(`${username} is online`, "success", () => {
          window.dispatchEvent(new CustomEvent("tetra:open-social"));
        });
      }
    };

    socket.on("game:config", handleGameConfig);
    socket.on("connect_error", handleConnectError);
    socket.on("server:error", handleServerError);
    socket.on("notifications", handleNotifications);
    socket.on("social:update", handleSocialUpdate);

    return () => {
      socket.off("game:config", handleGameConfig);
      socket.off("connect_error", handleConnectError);
      socket.off("server:error", handleServerError);
      socket.off("notifications", handleNotifications);
      socket.off("social:update", handleSocialUpdate);
    };
  }, [location.pathname, navigate, session, showToast]);

  return null;
}
