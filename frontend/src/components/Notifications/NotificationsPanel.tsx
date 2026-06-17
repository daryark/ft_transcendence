import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authFetch } from "../../auth/authFetch";
import { getSessionUser } from "../../auth/session";
import { getSocket, subscribeToSocket } from "../../socket/socketClient";
import "./NotificationsPanel.scss";

type NotificationActor = {
  id: number;
  username: string;
  avatarId?: number | null;
};

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  payload?: unknown;
  isRead: boolean;
  createdAt: string | null;
  readAt: string | null;
  actor: NotificationActor | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  onOpenSocialTab?: (tab: "friends" | "requests" | "blocked") => void;
};

const NOTIFICATIONS_ENDPOINT = "/api/notifications";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const unwrapPayload = (value: unknown) => {
  const object = asRecord(value);
  return asRecord(object.data ?? object.result ?? object.payload ?? object);
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toNotification = (value: unknown): NotificationItem | null => {
  const object = asRecord(value);
  const id = toNumber(object.id);
  const title = String(object.title ?? "").trim();
  const body = String(object.body ?? "").trim();

  if (!id || !title || !body) {
    return null;
  }

  const actorObject = asRecord(object.actor);
  const actorId = toNumber(actorObject.id);
  const actorUsername = String(actorObject.username ?? "").trim();

  return {
    id,
    type: String(object.type ?? "notification"),
    title,
    body,
    link: typeof object.link === "string" && object.link.trim() ? object.link : null,
    payload: object.payload,
    isRead: Boolean(object.isRead ?? object.is_read),
    createdAt:
      typeof object.createdAt === "string"
        ? object.createdAt
        : typeof object.created_at === "string"
          ? object.created_at
          : null,
    readAt:
      typeof object.readAt === "string"
        ? object.readAt
        : typeof object.read_at === "string"
          ? object.read_at
          : null,
    actor: actorId && actorUsername ? { id: actorId, username: actorUsername, avatarId: toNumber(actorObject.avatarId ?? actorObject.avatar_id) } : null,
  };
};

const formatRelativeTime = (iso?: string | null) => {
  if (!iso) return "JUST NOW";

  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN${minutes === 1 ? "" : "S"} AGO`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} H${hours === 1 ? "" : "S"} AGO`;

  const days = Math.floor(hours / 24);
  return `${days} D${days === 1 ? "" : "S"} AGO`;
};

const parseError = async (response: Response, fallback: string) => {
  try {
    const payload = asRecord(await response.json());
    return String(payload.error ?? payload.message ?? fallback);
  } catch {
    return fallback;
  }
};

const notificationRoute = (notification: NotificationItem) => {
  if (notification.type === "friend_request") {
    return { kind: "social" as const, tab: "requests" as const };
  }

  if (
    notification.type === "friend_request_accepted" ||
    notification.type === "friend_request_rejected"
  ) {
    return { kind: "social" as const, tab: "friends" as const };
  }

  if (notification.type === "achievement_unlocked") {
    return { kind: "path" as const, path: "/channel/achievements" };
  }

  if (notification.link) {
    return { kind: "path" as const, path: notification.link };
  }

  return null;
};

export default function NotificationsPanel({
  isOpen,
  onClose,
  onUnreadCountChange,
  onOpenSocialTab,
}: Props) {
  const navigate = useNavigate();
  const currentUser = getSessionUser();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(
    () => notifications.filter((notification: NotificationItem) => !notification.isRead).length,
    [notifications],
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  const loadNotifications = async (signal?: AbortSignal) => {
    if (!currentUser) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch(`${NOTIFICATIONS_ENDPOINT}?page=1&limit=50`, {
        signal,
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "FAILED TO LOAD NOTIFICATIONS"));
      }

      const payload = unwrapPayload(await response.json());
      const items = Array.isArray(payload.items) ? payload.items : [];
      setNotifications(items.map(toNotification).filter(Boolean) as NotificationItem[]);
    } catch (caughtError) {
      if (!signal?.aborted) {
        setNotifications([]);
        setError(
          caughtError instanceof Error ? caughtError.message : "FAILED TO LOAD NOTIFICATIONS",
        );
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const controller = new AbortController();
    void loadNotifications(controller.signal);

    return () => controller.abort();
  }, [currentUser]);

  useEffect(() => {
    let activeSocket = getSocket();

    const handleNotifications = () => {
      if (currentUser) {
        void loadNotifications();
      }
    };

    const attach = () => {
      const nextSocket = getSocket();
      if (activeSocket === nextSocket) return;
      activeSocket?.off("notifications", handleNotifications);
      activeSocket = nextSocket;
      activeSocket?.on("notifications", handleNotifications);
    };

    activeSocket?.on("notifications", handleNotifications);
    const unsubscribe = subscribeToSocket(attach);

    return () => {
      unsubscribe();
      activeSocket?.off("notifications", handleNotifications);
    };
  }, [currentUser]);

  const markAsRead = async (notification: NotificationItem) => {
    if (notification.isRead) return;

    setNotifications((current: NotificationItem[]) =>
      current.map((entry: NotificationItem) =>
        entry.id === notification.id ? { ...entry, isRead: true, readAt: new Date().toISOString() } : entry,
      ),
    );

    try {
      const response = await authFetch(`${NOTIFICATIONS_ENDPOINT}/${notification.id}/read`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "FAILED TO UPDATE NOTIFICATION"));
      }
    } catch (caughtError) {
      setNotifications((current: NotificationItem[]) =>
        current.map((entry: NotificationItem) =>
          entry.id === notification.id ? { ...entry, isRead: false, readAt: null } : entry,
        ),
      );
      setError(caughtError instanceof Error ? caughtError.message : "FAILED TO UPDATE NOTIFICATION");
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = new Set(
      notifications
        .filter((notification: NotificationItem) => !notification.isRead)
        .map((notification: NotificationItem) => notification.id),
    );

    if (unreadIds.size === 0) return;

    const readAt = new Date().toISOString();
    setNotifications((current: NotificationItem[]) =>
      current.map((entry: NotificationItem) =>
        unreadIds.has(entry.id) ? { ...entry, isRead: true, readAt } : entry,
      ),
    );

    try {
      const response = await authFetch(`${NOTIFICATIONS_ENDPOINT}/read`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "FAILED TO UPDATE NOTIFICATIONS"));
      }
    } catch (caughtError) {
      setNotifications((current: NotificationItem[]) =>
        current.map((entry: NotificationItem) =>
          unreadIds.has(entry.id) ? { ...entry, isRead: false, readAt: null } : entry,
        ),
      );
      setError(caughtError instanceof Error ? caughtError.message : "FAILED TO UPDATE NOTIFICATIONS");
    }
  };

  const openNotification = async (notification: NotificationItem) => {
    await markAsRead(notification);
    const route = notificationRoute(notification);

    if (!route) return;

    onClose();

    if (route.kind === "social") {
      onOpenSocialTab?.(route.tab);
      return;
    }

    navigate(route.path);
  };

  return (
    <>
      <div
        className={`notificationsOverlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      <aside
        aria-label="Notifications panel"
        aria-modal={isOpen}
        className={`notificationsPanel ${isOpen ? "open" : ""}`}
        role="dialog"
      >
        <header className="notificationsHeader">
          <div>
            <span className="notificationsEyebrow">SYSTEM FEED</span>
            <h2>NOTIFICATION</h2>
          </div>
          <button className="notificationsClose" onClick={onClose} type="button">
            CLOSE
          </button>
        </header>

        <div className="notificationsSummary">
          <span>{unreadCount} UNREAD</span>
          <span>{notifications.length} ITEMS</span>
        </div>

        <div className="notificationsList">
          {isLoading && <div className="panelState">LOADING...</div>}
          {!isLoading && error && <div className="panelState errorState">{error}</div>}
          {!isLoading && !error && notifications.length === 0 && (
            <div className="panelState">NO NOTIFICATIONS YET</div>
          )}

          {notifications.map((notification: NotificationItem) => (
            <button
              className={`notificationRow ${notification.isRead ? "" : "notificationRow--unread"}`}
              key={notification.id}
              onClick={() => void openNotification(notification)}
              type="button"
            >
              <span className="notificationDot" />
              <span className="notificationCopy">
                <span className="notificationTitle">{notification.title}</span>
                <span className="notificationBody">{notification.body}</span>
                <span className="notificationMeta">
                  {formatRelativeTime(notification.createdAt)}
                  {notification.actor?.username ? ` • ${notification.actor.username}` : ""}
                </span>
              </span>
                {!notification.isRead && <span className="notificationBadge">NEW</span>}
            </button>
          ))}
        </div>

        <div className="notificationsFooter">
          <button type="button" onClick={() => void markAllAsRead()}>
            MARK AS READ
          </button>
          <button type="button" onClick={() => void loadNotifications()}>
            REFRESH
          </button>
        </div>
      </aside>
    </>
  );
}
