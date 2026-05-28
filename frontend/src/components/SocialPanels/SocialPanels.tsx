import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../auth/authFetch";
import { getSessionUser } from "../../auth/session";
import "./SocialPanels.scss";

type FriendStatus = "online" | "offline" | "blocked";
type Filter = "online" | "all" | "blocked";

type Friend = {
  id: number;
  username: string;
  status: FriendStatus;
};

type Notification = {
  id: number;
  title: string;
  text: string;
};

type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  createdAt: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const FRIENDS_ENDPOINT = "/api/friends";
const PLAYERS_SEARCH_ENDPOINT = "/api/users/search";
const NOTIFICATIONS_ENDPOINT = "/api/notifications";
const MESSAGES_ENDPOINT = "/api/messages";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  const object = asRecord(value);
  const nested =
    object.friends ??
    object.players ??
    object.users ??
    object.items ??
    object.notifications ??
    object.messages;

  return Array.isArray(nested) ? nested : [];
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toStatus = (value: unknown): FriendStatus => {
  const status = String(value ?? "").toLowerCase();

  if (status === "blocked") {
    return "blocked";
  }

  if (status === "online") {
    return "online";
  }

  return "offline";
};

const toFriend = (value: unknown): Friend | null => {
  const object = asRecord(value);
  const user = asRecord(object.user ?? object.friend ?? object.player);
  const id = toNumber(object.id) ?? toNumber(user.id);
  const username = String(
    object.username ?? user.username ?? object.name ?? user.name ?? "",
  ).trim();

  if (!id || !username) {
    return null;
  }

  return {
    id,
    username,
    status: toStatus(
      object.status ?? object.presence ?? user.status ?? user.presence,
    ),
  };
};

const toNotification = (value: unknown): Notification | null => {
  const object = asRecord(value);
  const id = toNumber(object.id);
  const title = String(object.title ?? object.type ?? "").trim();
  const text = String(object.text ?? object.message ?? object.content ?? "").trim();

  if (!id || (!title && !text)) {
    return null;
  }

  return {
    id,
    title: title || "NOTIFICATION",
    text,
  };
};

const toMessage = (value: unknown): Message | null => {
  const object = asRecord(value);
  const id = toNumber(object.id);
  const senderId = toNumber(object.senderId ?? object.sender_id);
  const receiverId = toNumber(object.receiverId ?? object.receiver_id);
  const content = String(object.content ?? "").trim();

  if (!id || !senderId || !receiverId || !content) {
    return null;
  }

  return {
    id,
    senderId,
    receiverId,
    content,
    createdAt: typeof object.createdAt === "string"
      ? object.createdAt
      : typeof object.created_at === "string"
        ? object.created_at
        : null,
  };
};

const mergeById = (left: Friend[], right: Friend[]) => {
  const merged = new Map<number, Friend>();

  [...left, ...right].forEach((friend) => merged.set(friend.id, friend));

  return Array.from(merged.values()).sort((a, b) =>
    a.username.localeCompare(b.username),
  );
};

const SocialPanels = ({ isOpen, onClose }: Props) => {
  const currentUser = getSessionUser();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("online");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [friendsError, setFriendsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const trimmedSearch = search.trim();

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      return;
    }

    const controller = new AbortController();

    const loadSocialData = async () => {
      setIsFriendsLoading(true);
      setFriendsError("");

      try {
        const [friendsResponse, notificationsResponse] = await Promise.all([
          authFetch(FRIENDS_ENDPOINT, { signal: controller.signal }),
          authFetch(NOTIFICATIONS_ENDPOINT, { signal: controller.signal }),
        ]);

        if (!friendsResponse.ok) {
          throw new Error("Failed to load friends");
        }

        const friendsData = await friendsResponse.json();
        setFriends(asArray(friendsData).map(toFriend).filter(Boolean) as Friend[]);

        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json();
          setNotifications(
            asArray(notificationsData).map(toNotification).filter(Boolean) as Notification[],
          );
        } else {
          setNotifications([]);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFriends([]);
          setNotifications([]);
          setFriendsError(error instanceof Error ? error.message : "Failed to load social data");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFriendsLoading(false);
        }
      }
    };

    loadSocialData();

    return () => controller.abort();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || trimmedSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();

    const searchPlayers = async () => {
      try {
        const encodedSearch = encodeURIComponent(trimmedSearch);
        const response = await authFetch(
          `${PLAYERS_SEARCH_ENDPOINT}?nickname=${encodedSearch}&query=${encodedSearch}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setSearchResults([]);
          return;
        }

        const data = await response.json();
        const players = asArray(data)
          .map(toFriend)
          .filter(Boolean) as Friend[];

        setSearchResults(players.filter((player) => player.id !== currentUser?.id));
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      }
    };

    const timeoutId = window.setTimeout(searchPlayers, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentUser?.id, isOpen, trimmedSearch]);

  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      setMessagesError("");
      return;
    }

    const controller = new AbortController();

    const loadMessages = async () => {
      setIsMessagesLoading(true);
      setMessagesError("");

      try {
        const response = await authFetch(
          `${MESSAGES_ENDPOINT}/conversation/${selectedFriend.id}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to load messages");
        }

        const data = await response.json();
        setMessages(asArray(data).map(toMessage).filter(Boolean) as Message[]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessages([]);
          setMessagesError(error instanceof Error ? error.message : "Failed to load messages");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsMessagesLoading(false);
        }
      }
    };

    loadMessages();

    return () => controller.abort();
  }, [selectedFriend]);

  const filteredFriends = useMemo(() => {
    const isSearching = trimmedSearch.length >= 2;
    const list = trimmedSearch.length >= 2
      ? mergeById(friends, searchResults)
      : friends;

    return list.filter((friend) => {
      const matchesSearch =
        !trimmedSearch ||
        friend.username.toLowerCase().includes(trimmedSearch.toLowerCase());

      if (!matchesSearch) {
        return false;
      }

      if (filter === "all" || (isSearching && filter !== "blocked")) {
        return friend.status !== "blocked";
      }

      return friend.status === filter;
    });
  }, [filter, friends, searchResults, trimmedSearch]);

  const sendMessage = async () => {
    const content = draft.trim();

    if (!selectedFriend || !content) {
      return;
    }

    setDraft("");
    setMessagesError("");

    try {
      const response = await authFetch(MESSAGES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverId: selectedFriend.id,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      const sentMessage = toMessage(data.message ?? data);

      if (sentMessage) {
        setMessages((current) => [...current, sentMessage]);
      }
    } catch (error) {
      setDraft(content);
      setMessagesError(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  return (
    <>
      <div
        className={`socialOverlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      <aside className={`friendsPanel ${isOpen ? "open" : ""}`}>
        <div className="peopleHeader">
          <h2>PEOPLE</h2>
          <span className="presenceLabel">
            In Menus <span className="presenceDot" />
          </span>
        </div>

        <div className="peopleSearchWrap">
          <span className="searchGlyph" />
          <input
            className="searchInput peopleSearch"
            placeholder="FIND SOMEONE..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="filterButtons peopleTabs">
          <button
            className={filter === "online" ? "active" : ""}
            onClick={() => setFilter("online")}
            type="button"
          >
            ONLINE
          </button>

          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
            type="button"
          >
            ALL
          </button>

          <button
            className={filter === "blocked" ? "active" : ""}
            onClick={() => setFilter("blocked")}
            type="button"
          >
            BLOCKED
          </button>
        </div>

        <div className="friendsList peopleList">
          {isFriendsLoading && <div className="panelState">LOADING...</div>}
          {!isFriendsLoading && friendsError && (
            <div className="panelState errorState">{friendsError}</div>
          )}
          {!isFriendsLoading && !friendsError && filteredFriends.length === 0 && (
            <div className="panelState">NO PLAYERS FOUND</div>
          )}

          {filteredFriends.map((friend) => (
            <button
              key={friend.id}
              className={`friendCard ${selectedFriend?.id === friend.id ? "active" : ""}`}
              onClick={() => setSelectedFriend(friend)}
              type="button"
            >
              <div className={`statusDot ${friend.status}`} />

              <div className="friendInfo">
                <span className="friendName">{friend.username}</span>
                <span className="friendStatus">
                  <>◇ {friend.status}</>
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <aside className={`chatPanel ${isOpen && selectedFriend ? "open" : ""}`}>
        {selectedFriend && (
          <>
            <div className="chatHeader">
              <button
                className="backChat"
                onClick={() => setSelectedFriend(null)}
                type="button"
              >
                BACK
              </button>
              <div>
                <h2>{selectedFriend.username}</h2>
                <span className={`chatStatus ${selectedFriend.status}`}>
                  {selectedFriend.status}
                </span>
              </div>
            </div>

            <div className="messagesList">
              {isMessagesLoading && <div className="panelState">LOADING...</div>}
              {!isMessagesLoading && messagesError && (
                <div className="panelState errorState">{messagesError}</div>
              )}
              {!isMessagesLoading && !messagesError && messages.length === 0 && (
                <div className="panelState">NO MESSAGES YET</div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`messageBubble ${
                    message.senderId === currentUser?.id ? "mine" : "theirs"
                  }`}
                >
                  <p>{message.content}</p>
                  {message.createdAt && (
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  )}
                </div>
              ))}
            </div>

            <form
              className="messageForm"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                className="messageInput"
                placeholder="MESSAGE..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={5000}
              />
              <button type="submit" disabled={!draft.trim()}>
                SEND
              </button>
            </form>
          </>
        )}
      </aside>

      <aside className={`notificationsPanel ${isOpen ? "open" : ""}`}>
        <div className="panelHeader">
          <h2>NOTIFICATIONS</h2>
        </div>

        <div className="notificationsList">
          {notifications.length === 0 && (
            <div className="panelState">NO NOTIFICATIONS</div>
          )}

          {notifications.map((notification) => (
            <div key={notification.id} className="notificationCard">
              <span className="notificationTitle">
                {notification.title}
              </span>

              <p>{notification.text}</p>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default SocialPanels;
