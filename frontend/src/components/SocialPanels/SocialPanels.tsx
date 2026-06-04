import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { authFetch } from "../../auth/authFetch";
import { getSessionUser } from "../../auth/session";
import "./SocialPanels.scss";

type FriendStatus = "online" | "offline" | "blocked";
type Filter = "online" | "all" | "blocked";

type Friend = {
  id: number;
  username: string;
  status: FriendStatus;
  avatarId?: number;
};

type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  createdAt: string | null;
};

type ModeStats = {
  value?: string;
  achievedAgo?: string;
};

type MiniProfile = {
  id: number;
  username: string;
  avatarId: number;
  level: number;
  modes: {
    league?: { tr?: number; rank?: string } | null;
    quickPlay?: ModeStats | null;
    fortyLines?: ModeStats | null;
    blitz?: ModeStats | null;
    zen?: ModeStats | null;
  };
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const FRIENDS_ENDPOINT = "/api/friends";
const PLAYERS_SEARCH_ENDPOINT = "/api/users/search";
const MESSAGES_ENDPOINT = "/api/messages";

const avatarColors = [
  "#d6cc1e",
  "#8ed053",
  "#6ec6ff",
  "#ff7f50",
  "#c986ff",
  "#ffcc66",
  "#6ee7b7",
  "#ef6f8f",
  "#a7f3d0",
  "#f97316",
  "#93c5fd",
  "#f0abfc",
  "#fde047",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#c4b5fd",
  "#facc15",
  "#5eead4",
  "#e879f9",
];

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

const getAvatarStyle = (avatarId?: number) => {
  const index =
    avatarId && avatarId >= 1 && avatarId <= avatarColors.length
      ? avatarId - 1
      : 0;

  return { "--avatar-color": avatarColors[index] } as CSSProperties;
};

const toFriend = (value: unknown): Friend | null => {
  const object = asRecord(value);
  const user = asRecord(object.user ?? object.friend ?? object.player);
  const id =
    toNumber(object.id) ??
    toNumber(object.userId) ??
    toNumber(object.friendId) ??
    toNumber(user.id);
  const username = String(
    object.username ?? user.username ?? object.name ?? user.name ?? "",
  ).trim();

  if (!id || !username) {
    return null;
  }

  return {
    id,
    username,
    avatarId:
      toNumber(object.avatarId ?? object.avatar_id ?? user.avatarId ?? user.avatar_id) ??
      undefined,
    status: toStatus(
      object.status ?? object.presence ?? user.status ?? user.presence,
    ),
  };
};

const toMessage = (value: unknown): Message | null => {
  const object = asRecord(value);
  const id = toNumber(object.id);
  const senderId = toNumber(object.senderId ?? object.sender_id);
  const receiverId = toNumber(object.receiverId ?? object.receiver_id);
  const content = String(object.content ?? object.message ?? "").trim();

  if (!id || !senderId || !receiverId || !content) {
    return null;
  }

  return {
    id,
    senderId,
    receiverId,
    content,
    createdAt:
      typeof object.createdAt === "string"
        ? object.createdAt
        : typeof object.created_at === "string"
          ? object.created_at
          : null,
  };
};

const unwrapMiniProfile = (payload: unknown): MiniProfile | null => {
  const object = asRecord(payload);
  const profile = asRecord(object.miniprofile ?? object.profile ?? object);
  const id = toNumber(profile.id);
  const username = String(profile.username ?? "").trim();

  if (!id || !username) {
    return null;
  }

  return {
    id,
    username,
    avatarId: toNumber(profile.avatarId ?? profile.avatar_id) ?? 1,
    level: toNumber(profile.level) ?? 1,
    modes: asRecord(profile.modes) as MiniProfile["modes"],
  };
};

const mergeById = (left: Friend[], right: Friend[]) => {
  const merged = new Map<number, Friend>();

  [...left, ...right].forEach((friend) => merged.set(friend.id, friend));

  return Array.from(merged.values()).sort((a, b) =>
    a.username.localeCompare(b.username),
  );
};

const formatModeValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "NO DATA";
};

const ProfileModal = ({
  friend,
  profile,
  isLoading,
  error,
  onClose,
  onOpenChat,
  onOpenFullProfile,
}: {
  friend: Friend;
  profile: MiniProfile | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenFullProfile: () => void;
}) => {
  const modes = profile?.modes ?? {};
  const league = modes.league;
  const fortyLines = modes.fortyLines;
  const blitz = modes.blitz;
  const quickPlay = modes.quickPlay;
  const displayAvatarId = profile?.avatarId ?? friend.avatarId ?? 1;
  const displayUsername = profile?.username ?? friend.username;

  return (
    <div className="miniProfileLayer" onMouseDown={onClose}>
      <section
        className="miniProfileCard"
        aria-label={`${displayUsername} mini profile`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="miniProfileTop">
          <div className="miniProfileAvatar" style={getAvatarStyle(displayAvatarId)} />

          <div className="miniProfileIdentity">
            <h2>{displayUsername}</h2>
            <p>
              LEVEL {profile?.level ?? "-"} <span>◇</span> {friend.status}
            </p>
          </div>

          <div className="miniProfileActions">
            <button type="button" onClick={onClose}>
              CLOSE
            </button>
            <button type="button" onClick={onOpenChat}>
              MESSAGE
            </button>
          </div>
        </div>

        {isLoading && <div className="miniProfileState">LOADING PROFILE...</div>}
        {!isLoading && error && <div className="miniProfileState errorState">{error}</div>}

        {!isLoading && !error && (
          <>
            <div className="miniProfileLevel">
              <span>{profile?.level ?? "-"}</span>
              <div className="miniProfileLevelBar">
                <i style={{ width: `${Math.min((profile?.level ?? 1) % 100, 100)}%` }} />
              </div>
            </div>

            <div className="miniStatsGrid">
              <article>
                <span>TETRA LEAGUE</span>
                <strong>
                  {league?.rank ? `${league.rank.toUpperCase()} ` : ""}
                  {league?.tr ? `${formatModeValue(league.tr)}TR` : "NO DATA"}
                </strong>
              </article>

              <article>
                <span>40 LINES</span>
                <strong>{formatModeValue(fortyLines?.value)}</strong>
                {fortyLines?.achievedAgo && <small>{fortyLines.achievedAgo}</small>}
              </article>

              <article>
                <span>BLITZ</span>
                <strong>{formatModeValue(blitz?.value)}</strong>
                {blitz?.achievedAgo && <small>{blitz.achievedAgo}</small>}
              </article>

              <article className="miniStatsWide">
                <span>QUICK PLAY</span>
                <strong>{formatModeValue(quickPlay?.value)}</strong>
                {quickPlay?.achievedAgo && <small>{quickPlay.achievedAgo}</small>}
              </article>
            </div>
          </>
        )}

        <button className="fullProfileButton" type="button" onClick={onOpenFullProfile}>
          VIEW FULL PROFILE
        </button>
      </section>
    </div>
  );
};

const SocialPanels = ({ isOpen, onClose }: Props) => {
  const navigate = useNavigate();
  const currentUser = getSessionUser();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [profileFriend, setProfileFriend] = useState<Friend | null>(null);
  const [miniProfile, setMiniProfile] = useState<MiniProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [friendsError, setFriendsError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const trimmedSearch = search.trim();

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      setProfileFriend(null);
      setMiniProfile(null);
      setSearch("");
      return;
    }

    const controller = new AbortController();

    const loadFriends = async () => {
      setIsFriendsLoading(true);
      setFriendsError("");

      try {
        const response = await authFetch(FRIENDS_ENDPOINT, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("FAILED TO LOAD FRIENDS");
        }

        const data = await response.json();
        setFriends(asArray(data).map(toFriend).filter(Boolean) as Friend[]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setFriends([]);
          setFriendsError(
            error instanceof Error ? error.message : "FAILED TO LOAD FRIENDS",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFriendsLoading(false);
        }
      }
    };

    loadFriends();

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
          `${PLAYERS_SEARCH_ENDPOINT}?q=${encodedSearch}&limit=20`,
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
      setDraft("");
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
          throw new Error("MESSAGES API IS NOT READY YET");
        }

        const data = await response.json();
        setMessages(asArray(data).map(toMessage).filter(Boolean) as Message[]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessages([]);
          setMessagesError(
            error instanceof Error ? error.message : "FAILED TO LOAD MESSAGES",
          );
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

  useEffect(() => {
    if (!profileFriend) {
      setMiniProfile(null);
      setProfileError("");
      return;
    }

    const controller = new AbortController();

    const loadMiniProfile = async () => {
      setIsProfileLoading(true);
      setProfileError("");

      try {
        const response = await authFetch(
          `/api/users/${encodeURIComponent(profileFriend.username)}/miniprofile`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("FAILED TO LOAD PROFILE");
        }

        const data = await response.json();
        const parsedProfile = unwrapMiniProfile(data);

        if (!parsedProfile) {
          throw new Error("PROFILE RESPONSE IS EMPTY");
        }

        setMiniProfile(parsedProfile);
      } catch (error) {
        if (!controller.signal.aborted) {
          setMiniProfile(null);
          setProfileError(
            error instanceof Error ? error.message : "FAILED TO LOAD PROFILE",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsProfileLoading(false);
        }
      }
    };

    loadMiniProfile();

    return () => controller.abort();
  }, [profileFriend]);

  const filteredFriends = useMemo(() => {
    const isSearching = trimmedSearch.length >= 2;
    const list = isSearching ? mergeById(friends, searchResults) : friends;
    const normalizedSearch = trimmedSearch.toLowerCase();

    return list.filter((friend) => {
      const matchesSearch =
        !normalizedSearch ||
        friend.username.toLowerCase().includes(normalizedSearch);

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
        throw new Error("MESSAGES API IS NOT READY YET");
      }

      const data = await response.json();
      const sentMessage = toMessage(data.message ?? data);

      if (sentMessage) {
        setMessages((current) => [...current, sentMessage]);
      }
    } catch (error) {
      setDraft(content);
      setMessagesError(
        error instanceof Error ? error.message : "FAILED TO SEND MESSAGE",
      );
    }
  };

  const openProfile = (friend: Friend) => {
    setProfileFriend(friend);
  };

  const openFullProfile = () => {
    const username = miniProfile?.username ?? profileFriend?.username;

    if (!username) {
      return;
    }

    setProfileFriend(null);
    onClose();
    navigate(`/profile/${encodeURIComponent(username)}`);
  };

  return (
    <>
      <div
        className={`socialOverlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      <aside
        className={`socialPanel ${isOpen ? "open" : ""} ${
          selectedFriend ? "chatMode" : "peopleMode"
        }`}
      >
        {!selectedFriend ? (
          <>
            <div className="peopleHeader">
              <h2>PEOPLE</h2>
              <span className="presenceLabel">
                In Menus <span className="presenceDiamond" />
              </span>
            </div>

            <label className="peopleSearchWrap">
              <span className="searchGlyph" />
              <input
                className="peopleSearch"
                placeholder="FIND SOMEONE..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="peopleTabs">
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

            <div className="peopleList">
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
                  className="friendRow"
                  onClick={() => setSelectedFriend(friend)}
                  type="button"
                >
                  <span className="friendAvatar" style={getAvatarStyle(friend.avatarId)} />

                  <span className="friendInfo">
                    <span className="friendName">{friend.username}</span>
                    <span className={`friendStatus ${friend.status}`}>
                      ◇ {friend.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="chatLayout">
            <nav className="chatRail" aria-label="Conversation tools">
              <button
                className="railBack"
                aria-label="Back to people"
                onClick={() => setSelectedFriend(null)}
                type="button"
              >
                ←
              </button>

              <button className="railSearch" aria-label="Search" type="button">
                <span className="searchGlyph" />
              </button>

              <button
                className="railFriend active"
                aria-label={selectedFriend.username}
                onClick={() => openProfile(selectedFriend)}
                type="button"
              >
                <span
                  className="friendAvatar"
                  style={getAvatarStyle(selectedFriend.avatarId)}
                />
              </button>
            </nav>

            <section className="directChat" aria-label={`${selectedFriend.username} chat`}>
              <header className="directChatHeader">
                <span
                  className="chatFriendAvatar"
                  style={getAvatarStyle(selectedFriend.avatarId)}
                />

                <div className="chatFriendTitle">
                  <h2>{selectedFriend.username}</h2>
                  <button
                    className="profileAction"
                    type="button"
                    onClick={() => openProfile(selectedFriend)}
                  >
                    PROFILE
                  </button>
                  <span className={`friendStatus ${selectedFriend.status}`}>
                    ◇ {selectedFriend.status}
                  </span>
                </div>
              </header>

              <div className="chatNotice">
                Please be civil. Staff will never ask for your credentials.
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
                  placeholder="message..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={5000}
                />
              </form>
            </section>
          </div>
        )}
      </aside>

      {profileFriend && (
        <ProfileModal
          friend={profileFriend}
          profile={miniProfile}
          isLoading={isProfileLoading}
          error={profileError}
          onClose={() => setProfileFriend(null)}
          onOpenChat={() => {
            setSelectedFriend(profileFriend);
            setProfileFriend(null);
          }}
          onOpenFullProfile={openFullProfile}
        />
      )}
    </>
  );
};

export default SocialPanels;
