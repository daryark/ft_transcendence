import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { authFetch } from "../../auth/authFetch";
import { getSessionUser } from "../../auth/session";
import { getSocket, subscribeToSocket } from "../../socket/socketClient";
import Dialog from "../Dialog/Dialog";
import "./SocialPanels.scss";

type SocialTab = "friends" | "requests" | "blocked";
type RelationshipStatus = "none" | "pending" | "accepted" | "blocked";
type RequestDirection = "incoming" | "outgoing" | null;
type FriendAction = "add" | "accept" | "reject" | "remove" | "block" | "unblock";

type SocialPerson = {
  id: number;
  username: string;
  avatarId?: number;
  relationshipId?: number;
  relationshipStatus: RelationshipStatus;
  requestDirection: RequestDirection;
  blockedByCurrentUser?: boolean;
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
  initialTab?: SocialTab;
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

const unwrapPayload = (value: unknown) => {
  const object = asRecord(value);
  return asRecord(object.data ?? object.result ?? object.payload ?? object);
};

const unwrapItems = (value: unknown): unknown[] => {
  const payload = unwrapPayload(value);
  return Array.isArray(payload.items) ? payload.items : asArray(payload);
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getAvatarStyle = (avatarId?: number) => {
  const index =
    avatarId && avatarId >= 1 && avatarId <= avatarColors.length
      ? avatarId - 1
      : 0;

  return { "--avatar-color": avatarColors[index] } as CSSProperties;
};

const parseApiError = async (response: Response, fallback: string) => {
  try {
    const payload = asRecord(await response.json());
    return String(payload.error ?? payload.message ?? fallback);
  } catch {
    return fallback;
  }
};

const toRelationship = (
  value: unknown,
  currentUserId: number,
): SocialPerson | null => {
  const object = asRecord(value);
  const user = asRecord(object.otherUser);
  const id = toNumber(user.id);
  const username = String(user.username ?? "").trim();
  const relationshipId = toNumber(object.id);
  const senderId = toNumber(object.userId ?? object.user_id);
  const recipientId = toNumber(object.friendId ?? object.friend_id);
  const status = String(object.status ?? "").toLowerCase();

  if (!id || !username || !relationshipId) {
    return null;
  }

  const relationshipStatus: RelationshipStatus =
    status === "pending" || status === "accepted" || status === "blocked"
      ? status
      : "none";

  return {
    id,
    username,
    avatarId: toNumber(user.avatarId ?? user.avatar_id) ?? undefined,
    relationshipId,
    relationshipStatus,
    requestDirection:
      relationshipStatus === "pending"
        ? recipientId === currentUserId
          ? "incoming"
          : senderId === currentUserId
            ? "outgoing"
            : "incoming"
        : null,
    blockedByCurrentUser:
      relationshipStatus === "blocked" ? senderId === currentUserId : undefined,
  };
};

const toSearchPerson = (value: unknown): SocialPerson | null => {
  const object = asRecord(value);
  const id = toNumber(object.id);
  const username = String(object.username ?? "").trim();

  if (!id || !username) {
    return null;
  }

  return {
    id,
    username,
    avatarId: toNumber(object.avatarId ?? object.avatar_id) ?? undefined,
    relationshipStatus: "none",
    requestDirection: null,
  };
};

const mergeSearchRelationship = (
  person: SocialPerson,
  relationships: SocialPerson[],
): SocialPerson => {
  const match = relationships.find(
    (entry) => entry.id === person.id || entry.username.toLowerCase() === person.username.toLowerCase(),
  );

  if (!match) {
    return person;
  }

  return {
    ...person,
    relationshipId: match.relationshipId,
    relationshipStatus: match.relationshipStatus,
    requestDirection: match.requestDirection,
    blockedByCurrentUser: match.blockedByCurrentUser,
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

const formatModeValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "NO DATA";
};

const relationshipLabel = (person: SocialPerson) => {
  if (person.relationshipStatus === "accepted") return "FRIEND";
  if (person.relationshipStatus === "blocked") {
    return person.blockedByCurrentUser ? "BLOCKED" : "BLOCKED YOU";
  }
  if (person.requestDirection === "incoming") return "WANTS TO BE FRIENDS";
  if (person.requestDirection === "outgoing") return "REQUEST SENT";
  return "PLAYER";
};

const ActionButton = ({
  children,
  disabled,
  onClick,
  tone = "neutral",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "neutral" | "positive" | "danger";
}) => (
  <button
    className={`friendAction friendAction--${tone}`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

const PersonRow = ({
  person,
  actions,
  onOpenProfile,
}: {
  person: SocialPerson;
  actions: ReactNode;
  onOpenProfile: () => void;
}) => (
  <article
    className={`friendRow ${
      person.requestDirection ? `friendRow--${person.requestDirection}` : ""
    }`}
  >
    <button
      className="friendIdentity"
      onClick={onOpenProfile}
      type="button"
    >
      <span
        className="friendAvatar"
        style={getAvatarStyle(person.avatarId)}
      />
      <span className="friendInfo">
        <span className="friendName">{person.username}</span>
        <span
          className={`friendStatus friendStatus--${person.relationshipStatus}`}
        >
          {relationshipLabel(person)}
        </span>
      </span>
    </button>
    <div className="friendActions">{actions}</div>
  </article>
);

const ProfileModal = ({
  person,
  profile,
  isLoading,
  error,
  onClose,
  onOpenChat,
  onOpenFullProfile,
}: {
  person: SocialPerson;
  profile: MiniProfile | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onOpenChat?: () => void;
  onOpenFullProfile: () => void;
}) => {
  const modes = profile?.modes ?? {};
  const league = modes.league;
  const fortyLines = modes.fortyLines;
  const blitz = modes.blitz;
  const quickPlay = modes.quickPlay;
  const displayAvatarId = profile?.avatarId ?? person.avatarId ?? 1;
  const displayUsername = profile?.username ?? person.username;

  return (
    <Dialog
      className="miniProfileLayer"
      label={`${displayUsername} mini profile`}
      onClose={onClose}
    >
      <section
        className="miniProfileCard"
      >
        <div className="miniProfileTop">
          <div
            className="miniProfileAvatar"
            style={getAvatarStyle(displayAvatarId)}
          />

          <div className="miniProfileIdentity">
            <h2>{displayUsername}</h2>
            <p>
              LEVEL {profile?.level ?? "-"} <span>◇</span>{" "}
              {relationshipLabel(person)}
            </p>
          </div>

          <div className="miniProfileActions">
            <button type="button" onClick={onClose}>
              CLOSE
            </button>
            {onOpenChat && (
              <button type="button" onClick={onOpenChat}>
                MESSAGE
              </button>
            )}
          </div>
        </div>

        {isLoading && <div className="miniProfileState">LOADING PROFILE...</div>}
        {!isLoading && error && (
          <div className="miniProfileState errorState">{error}</div>
        )}

        {!isLoading && !error && (
          <>
            <div className="miniProfileLevel">
              <span>{profile?.level ?? "-"}</span>
              <div className="miniProfileLevelBar">
                <i
                  style={{
                    width: `${Math.min((profile?.level ?? 1) % 100, 100)}%`,
                  }}
                />
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
                {fortyLines?.achievedAgo && (
                  <small>{fortyLines.achievedAgo}</small>
                )}
              </article>
              <article>
                <span>BLITZ</span>
                <strong>{formatModeValue(blitz?.value)}</strong>
                {blitz?.achievedAgo && <small>{blitz.achievedAgo}</small>}
              </article>
              <article className="miniStatsWide">
                <span>QUICK PLAY</span>
                <strong>{formatModeValue(quickPlay?.value)}</strong>
                {quickPlay?.achievedAgo && (
                  <small>{quickPlay.achievedAgo}</small>
                )}
              </article>
            </div>
          </>
        )}

        <button
          className="fullProfileButton"
          type="button"
          onClick={onOpenFullProfile}
        >
          VIEW FULL PROFILE
        </button>
      </section>
    </Dialog>
  );
};

export default function SocialPanels({ isOpen, onClose, initialTab }: Props) {
  const navigate = useNavigate();
  const currentUser = getSessionUser();
  const [tab, setTab] = useState<SocialTab>("friends");
  const [search, setSearch] = useState("");
  const [relationships, setRelationships] = useState<SocialPerson[]>([]);
  const [searchResults, setSearchResults] = useState<SocialPerson[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<SocialPerson | null>(
    null,
  );
  const [profilePerson, setProfilePerson] = useState<SocialPerson | null>(null);
  const [miniProfile, setMiniProfile] = useState<MiniProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [socialError, setSocialError] = useState("");
  const [socialNotice, setSocialNotice] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    personId: number;
    action: FriendAction;
  } | null>(null);
  const trimmedSearch = search.trim();

  const loadRelationships = useCallback(
    async (signal?: AbortSignal) => {
      if (!currentUser) return;

      setIsSocialLoading(true);
      setSocialError("");

      try {
        const collected: SocialPerson[] = [];
        let page = 1;
        let total = 0;

        do {
          const response = await authFetch(
            `${FRIENDS_ENDPOINT}?status=all&page=${page}&limit=50`,
            { signal },
          );

          if (!response.ok) {
            throw new Error(
              await parseApiError(response, "FAILED TO LOAD FRIENDS"),
            );
          }

          const data = await response.json();
          const payload = unwrapPayload(data);
          const pageItems = unwrapItems(data)
            .map((item) => toRelationship(item, currentUser.id))
            .filter(Boolean) as SocialPerson[];

          collected.push(...pageItems);
          total = Number(payload.total ?? collected.length);
          page += 1;
          if (pageItems.length === 0) break;
        } while (collected.length < total);

        setRelationships(collected);
      } catch (error) {
        if (!signal?.aborted) {
          setRelationships([]);
          setSocialError(
            error instanceof Error ? error.message : "FAILED TO LOAD FRIENDS",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsSocialLoading(false);
        }
      }
    },
    [currentUser],
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriend(null);
      setProfilePerson(null);
      setMiniProfile(null);
      setSearch("");
      setSearchResults([]);
      setSocialNotice("");
      return;
    }

    const controller = new AbortController();
    if (initialTab) {
      setTab(initialTab);
    }
    void loadRelationships(controller.signal);
    return () => controller.abort();
  }, [initialTab, isOpen, loadRelationships]);

  useEffect(() => {
    let activeSocket = getSocket();

    const handleSocialUpdate = () => {
      if (isOpen) {
        void loadRelationships();
      }
    };

    const attach = () => {
      const nextSocket = getSocket();

      if (activeSocket === nextSocket) return;
      activeSocket?.off("social:update", handleSocialUpdate);
      activeSocket = nextSocket;
      activeSocket?.on("social:update", handleSocialUpdate);
    };

    activeSocket?.on("social:update", handleSocialUpdate);
    const unsubscribe = subscribeToSocket(attach);

    return () => {
      unsubscribe();
      activeSocket?.off("social:update", handleSocialUpdate);
    };
  }, [isOpen, loadRelationships]);

  useEffect(() => {
    if (!isOpen || trimmedSearch.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();

    const searchPlayers = async () => {
      setIsSearching(true);

      try {
        const response = await authFetch(
          `${PLAYERS_SEARCH_ENDPOINT}?q=${encodeURIComponent(trimmedSearch)}&limit=20`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(
            await parseApiError(response, "PLAYER SEARCH FAILED"),
          );
        }

        const players = unwrapItems(await response.json())
          .map(toSearchPerson)
          .filter(Boolean) as SocialPerson[];

        setSearchResults(
          players
            .filter((player) => player.id !== currentUser?.id)
            .map((player) => mergeSearchRelationship(player, relationships)),
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSocialError(
            error instanceof Error ? error.message : "PLAYER SEARCH FAILED",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    const timeoutId = window.setTimeout(searchPlayers, 250);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentUser?.id, isOpen, relationships, trimmedSearch]);

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

        setMessages(
          asArray(await response.json()).map(toMessage).filter(Boolean) as Message[],
        );
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

    void loadMessages();
    return () => controller.abort();
  }, [selectedFriend]);

  useEffect(() => {
    if (!profilePerson) {
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
          `/api/users/${encodeURIComponent(profilePerson.username)}/miniprofile`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("FAILED TO LOAD PROFILE");
        }

        const profile = unwrapMiniProfile(await response.json());
        if (!profile) throw new Error("PROFILE RESPONSE IS EMPTY");
        setMiniProfile(profile);
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

    void loadMiniProfile();
    return () => controller.abort();
  }, [profilePerson]);

  const friends = useMemo(
    () =>
      relationships
        .filter((person) => person.relationshipStatus === "accepted")
        .sort((a, b) => a.username.localeCompare(b.username)),
    [relationships],
  );
  const requests = useMemo(
    () =>
      relationships
        .filter((person) => person.relationshipStatus === "pending")
        .sort((a, b) => {
          if (a.requestDirection !== b.requestDirection) {
            return a.requestDirection === "incoming" ? -1 : 1;
          }
          return a.username.localeCompare(b.username);
        }),
    [relationships],
  );
  const blocked = useMemo(
    () =>
      relationships
        .filter((person) => person.relationshipStatus === "blocked")
        .sort((a, b) => a.username.localeCompare(b.username)),
    [relationships],
  );
  const visiblePeople =
    tab === "friends" ? friends : tab === "requests" ? requests : blocked;
  const searchNeedle = trimmedSearch.toLowerCase();
  const filteredPeople = visiblePeople.filter((person) =>
    person.username.toLowerCase().includes(searchNeedle),
  );
  const tabCount = (people: SocialPerson[]) =>
    searchNeedle
      ? people.filter((person) =>
          person.username.toLowerCase().includes(searchNeedle),
        ).length
      : people.length;

  const performAction = async (
    person: SocialPerson,
    action: FriendAction,
  ) => {
    const config: Record<
      FriendAction,
      { endpoint: string; body: Record<string, unknown>; success: string }
    > = {
      add: {
        endpoint: "/api/friends/request",
        body: { targetUserId: person.id },
        success: `FRIEND REQUEST SENT TO ${person.username}`,
      },
      accept: {
        endpoint: "/api/friends/respond",
        body: { requestId: person.relationshipId, action: "accept" },
        success: `${person.username} IS NOW YOUR FRIEND`,
      },
      reject: {
        endpoint: "/api/friends/respond",
        body: { requestId: person.relationshipId, action: "reject" },
        success: `REQUEST FROM ${person.username} REJECTED`,
      },
      remove: {
        endpoint: "/api/friends/remove",
        body: { targetUserId: person.id },
        success: `${person.username} REMOVED`,
      },
      block: {
        endpoint: "/api/friends/block",
        body: { targetUserId: person.id },
        success: `${person.username} BLOCKED`,
      },
      unblock: {
        endpoint: "/api/friends/remove",
        body: { targetUserId: person.id },
        success: `${person.username} UNBLOCKED`,
      },
    };
    const request = config[action];

    setPendingAction({ personId: person.id, action });
    setSocialError("");
    setSocialNotice("");

    try {
      const response = await authFetch(request.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, "ACTION FAILED"));
      }

      setSocialNotice(request.success);
      setRelationships((current) => {
        if (action === "accept") {
          return current.map((entry) =>
            entry.id === person.id
              ? {
                  ...entry,
                  relationshipStatus: "accepted",
                  requestDirection: null,
                }
              : entry,
          );
        }

        if (action === "reject" || action === "remove" || action === "unblock") {
          return current.filter((entry) => entry.id !== person.id);
        }

        if (action === "block") {
          const blockedPerson = {
            ...person,
            relationshipStatus: "blocked" as const,
            requestDirection: null,
            blockedByCurrentUser: true,
          };
          return [
            ...current.filter((entry) => entry.id !== person.id),
            blockedPerson,
          ];
        }

        return current;
      });
      setSearchResults((current) =>
        current.filter((entry) => entry.id !== person.id),
      );

      if (action === "remove" || action === "block") {
        setSelectedFriend((current) =>
          current?.id === person.id ? null : current,
        );
      }

      await loadRelationships();
    } catch (error) {
      setSocialError(
        error instanceof Error ? error.message : "SOCIAL ACTION FAILED",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const isActionPending = (person: SocialPerson) =>
    pendingAction?.personId === person.id;

  const renderActions = (person: SocialPerson) => {
    const disabled = isActionPending(person);

    if (person.relationshipStatus === "none") {
      return (
        <>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "add")}
            tone="positive"
          >
            ADD FRIEND
          </ActionButton>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "block")}
            tone="danger"
          >
            BLOCK
          </ActionButton>
        </>
      );
    }

    if (person.relationshipStatus === "accepted") {
      return (
        <>
          <ActionButton
            disabled={disabled}
            onClick={() => setSelectedFriend(person)}
            tone="positive"
          >
            MESSAGE
          </ActionButton>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "remove")}
          >
            REMOVE
          </ActionButton>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "block")}
            tone="danger"
          >
            BLOCK
          </ActionButton>
        </>
      );
    }

    if (person.relationshipStatus === "blocked") {
      return person.blockedByCurrentUser ? (
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "unblock")}
          >
            UNBLOCK
          </ActionButton>
        ) : null;
    }

    if (person.requestDirection === "incoming") {
      return (
        <>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "accept")}
            tone="positive"
          >
            ACCEPT
          </ActionButton>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "reject")}
          >
            REJECT
          </ActionButton>
          <ActionButton
            disabled={disabled}
            onClick={() => void performAction(person, "block")}
            tone="danger"
          >
            BLOCK
          </ActionButton>
        </>
      );
    }

    return (
      <>
        <ActionButton
          disabled={disabled}
          onClick={() => void performAction(person, "remove")}
        >
          CANCEL
        </ActionButton>
        <ActionButton
          disabled={disabled}
          onClick={() => void performAction(person, "block")}
          tone="danger"
        >
          BLOCK
        </ActionButton>
      </>
    );
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!selectedFriend || !content) return;

    setDraft("");
    setMessagesError("");

    try {
      const response = await authFetch(MESSAGES_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedFriend.id, content }),
      });

      if (!response.ok) {
        throw new Error("MESSAGES API IS NOT READY YET");
      }

      const data = await response.json();
      const sentMessage = toMessage(asRecord(data).message ?? data);
      if (sentMessage) setMessages((current) => [...current, sentMessage]);
    } catch (error) {
      setDraft(content);
      setMessagesError(
        error instanceof Error ? error.message : "FAILED TO SEND MESSAGE",
      );
    }
  };

  const openFullProfile = () => {
    const username = miniProfile?.username ?? profilePerson?.username;
    if (!username) return;

    setProfilePerson(null);
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
        aria-label="Social panel"
        aria-modal={isOpen}
        className={`socialPanel ${isOpen ? "open" : ""} ${
          selectedFriend ? "chatMode" : "peopleMode"
        }`}
        role="dialog"
      >
        {!selectedFriend ? (
          <>
            <div className="peopleHeader">
              <div>
                <span className="peopleEyebrow">YOUR NETWORK</span>
                <h2>SOCIAL</h2>
              </div>
              <button
                className="socialClose"
                onClick={onClose}
                type="button"
              >
                CLOSE
              </button>
            </div>

            <label className="peopleSearchWrap">
              <span className="searchGlyph" />
              <input
                className="peopleSearch"
                placeholder="SEARCH PLAYERS..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="peopleTabs">
              <button
                className={tab === "friends" ? "active" : ""}
                onClick={() => setTab("friends")}
                type="button"
              >
                FRIENDS <span>{tabCount(friends)}</span>
              </button>
              <button
                className={tab === "requests" ? "active" : ""}
                onClick={() => setTab("requests")}
                type="button"
              >
                REQUESTS <span>{tabCount(requests)}</span>
              </button>
              <button
                className={tab === "blocked" ? "active" : ""}
                onClick={() => setTab("blocked")}
                type="button"
              >
                BLOCKED <span>{tabCount(blocked)}</span>
              </button>
            </div>

            {socialNotice && (
              <div className="socialNotice">{socialNotice}</div>
            )}
            {socialError && (
              <div className="panelState errorState">{socialError}</div>
            )}

            <div className="peopleList">
              {trimmedSearch.length >= 2 && tab === "friends" && (
                <section className="peopleSection">
                  <h3>PLAYER SEARCH</h3>
                  {isSearching && <div className="panelState">SEARCHING...</div>}
                  {!isSearching && searchResults.length === 0 && (
                    <div className="panelState">NO NEW PLAYERS FOUND</div>
                  )}
                  {searchResults.map((person) => (
                    <PersonRow
                      key={`search-${person.id}`}
                      person={person}
                      actions={renderActions(person)}
                      onOpenProfile={() => setProfilePerson(person)}
                    />
                  ))}
                </section>
              )}

              <section className="peopleSection">
                <h3>
                  {tab === "friends"
                    ? "YOUR FRIENDS"
                    : tab === "requests"
                      ? "FRIEND REQUESTS"
                      : "BLOCKED PLAYERS"}
                </h3>
                {isSocialLoading && (
                  <div className="panelState">LOADING...</div>
                )}
                {!isSocialLoading && filteredPeople.length === 0 && (
                  <div className="panelState">
                    {tab === "friends"
                      ? "NO FRIENDS FOUND"
                      : tab === "requests"
                        ? "NO PENDING REQUESTS"
                        : "NO BLOCKED PLAYERS"}
                  </div>
                )}
                {filteredPeople.map((person) => (
                  <PersonRow
                    key={`relationship-${person.relationshipId}`}
                    person={person}
                    actions={renderActions(person)}
                    onOpenProfile={() => setProfilePerson(person)}
                  />
                ))}
              </section>
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
              <button
                className="railFriend active"
                aria-label={selectedFriend.username}
                onClick={() => setProfilePerson(selectedFriend)}
                type="button"
              >
                <span
                  className="friendAvatar"
                  style={getAvatarStyle(selectedFriend.avatarId)}
                />
              </button>
            </nav>

            <section
              className="directChat"
              aria-label={`${selectedFriend.username} chat`}
            >
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
                    onClick={() => setProfilePerson(selectedFriend)}
                  >
                    PROFILE
                  </button>
                  <button
                    className="profileAction profileAction--danger"
                    type="button"
                    onClick={() =>
                      void performAction(selectedFriend, "remove")
                    }
                  >
                    REMOVE
                  </button>
                </div>
              </header>

              <div className="chatNotice">
                Please be civil. Staff will never ask for your credentials.
              </div>

              <div className="messagesList">
                {isMessagesLoading && (
                  <div className="panelState">LOADING...</div>
                )}
                {!isMessagesLoading && messagesError && (
                  <div className="panelState errorState">{messagesError}</div>
                )}
                {!isMessagesLoading &&
                  !messagesError &&
                  messages.length === 0 && (
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
                  void sendMessage();
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

      {profilePerson && (
        <ProfileModal
          person={profilePerson}
          profile={miniProfile}
          isLoading={isProfileLoading}
          error={profileError}
          onClose={() => setProfilePerson(null)}
          onOpenChat={
            profilePerson.relationshipStatus === "accepted"
              ? () => {
                  setSelectedFriend(profilePerson);
                  setProfilePerson(null);
                }
              : undefined
          }
          onOpenFullProfile={openFullProfile}
        />
      )}
    </>
  );
}
