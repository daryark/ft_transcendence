import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { authFetch } from "../../../auth/authFetch";
import { userCapabilities } from "../../../auth/capabilities";
import {
  getSessionUser,
  subscribeToSession,
  type SessionUser,
} from "../../../auth/session";
import ProfileHeader from "../../../components/ProfileHeader/ProfileHeader";
import { getStoredGameConfig } from "../../../socket/gameConfigStorage";
import {
  getSocket,
  getSocketIdentityId,
  subscribeToSocket,
} from "../../../socket/socketClient";
import type {
  ControlsConfig,
  GarbageConfig,
  GeneralConfig,
  GravityConfig,
  MatchConfig,
} from "../../../../shared/types/config.types";
import type { GameStartPayload } from "../../game/types";
import { useConfirm } from "../../../components/Confirm/ConfirmProvider";
import { useToast } from "../../../components/Toast/ToastProvider";
import {
  createBackendConfigPatch,
  DEFAULT_MATCH_CONFIG,
  readCustomEditableConfig,
} from "./custom/config";
import {
  NumberField,
  ReadOnlyField,
  TextField,
  ToggleField,
} from "./custom/fields";
import type {
  CustomChatMessage,
  CustomEditableConfig,
  CustomRoomPlayer,
  CustomRoomConfig,
  CustomRoomSnapshot,
  CustomTab,
  ServerError,
  Visibility,
} from "./custom/types";
import "./MultiplayerMode.scss";

const customRoomPath = (code: string) =>
  `/play/multiplayer/custom/${encodeURIComponent(code)}`;
const CUSTOM_ACTIVE_ROOM_KEY = "tetra-custom-active-room-code";
let customRoomRouteVisited = false;
const BAG_TYPE_OPTIONS = [
  "7-bag",
  "14-bag",
  "7+1-bag",
  "7+2-bag",
  "7+X-bag",
  "pairs",
  "classic",
  "total_mayhem",
] as const;

const FIELD_HINTS = {
  roomName: "Room name is shown in uppercase to every player.",
  maxPlayers: "Range: min 0. 0 disables the player limit. Existing players are not kicked if the limit is lowered.",
  autoStart: "Range: 0 or 15-60 seconds. 0 disables auto start. Starts only with 2 or more players.",
  public: "Public rooms are listed and can be joined by anyone allowed by room rules.",
  anonymousAllowed: "When off, anonymous users cannot newly join or switch into player mode.",
  roundsToWin: "Range: min 1. First player to this many round points can win if win-by is satisfied.",
  winByRounds: "Range: min 0. 0 disables win-by. Otherwise leader must be ahead by this many round points.",
  goldenPoint: "Range: min 0. 0 disables golden point. If set, match ends no later than this round.",
  stock: "Range: min 0. 0 means no extra stock lives.",
  bagType: "7-bag is standard. 14-bag has two of each piece. 7+ bags add extras. Pairs uses three copies of two pieces. Classic avoids immediate repeats. Total mayhem is pure random.",
  boardWidth: "Range: 4-20 columns.",
  boardHeight: "Range: 10-40 rows.",
  hold: "Disables or enables the hold box.",
  nextPieces: "Range: 0-7. 0 hides the next queue.",
  showShadowPiece: "Shows or hides the ghost landing piece.",
  lockDelay: "Lock delay in 60 FPS ticks before a grounded piece places.",
  lockDelayDecrease: "Amount removed from lock delay on each gravity increase.",
  minimumLockDelay: "Smallest lock delay allowed after decreases.",
  gravity: "Range: 0-1. Higher values fall faster.",
  gravityIncrease: "Amount gravity increases each gravity interval.",
  gravitMarginTime: "Milliseconds before each gravity increase.",
  garbageMult: "Range: min 0. Multiplies outgoing garbage.",
  garbageCap: "Range: min 0. Max garbage lines entering at once.",
  garbageMaxCap: "Range: min 0. Max pending garbage stored.",
  allClearGarbage: "Range: min 0. Extra garbage sent on all clear.",
  garbageDelay: "Milliseconds before pending garbage can enter.",
  garbageDelayOnClear: "Milliseconds added to garbage delay after clearing lines.",
  garbageTargeting: "Payback targets attackers, even spreads garbage, random chooses random targets.",
  garbageColumnChangeChance: "Range: 0-1. Chance that the garbage hole column changes.",
} as const;

function normalizeChatMessage(
  message: Partial<CustomChatMessage> & {
    sender?: string;
    message?: string;
  },
  index: number,
): CustomChatMessage {
  return {
    id: message.id ?? `${Date.now()}-${index}`,
    author: message.author ?? message.sender ?? "PLAYER",
    actor: message.actor,
    system: message.system,
    text: message.text ?? message.message ?? "",
  };
}

export default function Custom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode: roomCodeParam } = useParams<{ roomCode?: string }>();
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const capabilities = userCapabilities(user);
  const confirm = useConfirm();
  const { showToast } = useToast();
  const routeRoomCode = useMemo(() => {
    const room =
      roomCodeParam ?? new URLSearchParams(location.search).get("room");

    return room?.trim().toUpperCase() ?? "";
  }, [location.search, roomCodeParam]);
  const autoJoinAttemptedCodeRef = useRef("");
  const leavingRoomRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const [tab, setTab] = useState<CustomTab>("room");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomStatus, setRoomStatus] =
    useState<CustomRoomSnapshot["status"]>("lobby");
  const [status, setStatus] = useState(() =>
    routeRoomCode ? "JOINING ROOM" : "",
  );
  const [config, setConfig] = useState<CustomEditableConfig>(() =>
    readCustomEditableConfig(getStoredGameConfig()),
  );
  const [players, setPlayers] = useState<CustomRoomPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<CustomChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [headerContent, setHeaderContent] = useState<HTMLElement | null>(null);
  const [socketIdentityId, setSocketIdentityId] = useState(() =>
    getSocketIdentityId(),
  );
  const [profilePlayer, setProfilePlayer] = useState<CustomRoomPlayer | null>(
    null,
  );
  const [savedConfigJson, setSavedConfigJson] = useState(() =>
    JSON.stringify(config),
  );
  const [autoStartEndsAt, setAutoStartEndsAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const inRoom = roomId !== null;
  const roomName = (config.roomConfig.roomName?.trim() || "CUSTOM ROOM").toUpperCase();
  const currentIdentityId = socketIdentityId ?? (user ? String(user.id) : null);
  const isCurrentUserHost = players.some(
    (player) => player.isHost && String(player.id) === currentIdentityId,
  );
  const currentRoomPlayer = players.find(
    (player) => String(player.id) === currentIdentityId,
  );
  const currentRoomRole = currentRoomPlayer?.role ?? "player";
  const activeRoomPlayers = players.filter(
    (player) => player.role !== "spectator",
  );
  const copyableRoomCode =
    roomCode || (roomId && roomId !== "pending-custom-room" ? roomId : "");
  const settingProps = { readOnly: !isCurrentUserHost };
  const isConfigDirty = JSON.stringify(config) !== savedConfigJson;
  const autoStartRemainingSeconds =
    roomStatus === "lobby" && autoStartEndsAt
      ? Math.max(0, Math.ceil((autoStartEndsAt - nowMs) / 1000))
      : null;

  useEffect(() => {
    document.body.classList.add("mp-custom-active");

    return () => {
      document.body.classList.remove("mp-custom-active");
      document.body.classList.remove("mp-custom-room-active");
      setHeaderContent(null);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("mp-custom-room-active", inRoom);
    setHeaderContent(
      inRoom ? document.querySelector<HTMLElement>(".header .content") : null,
    );

    return () => {
      document.body.classList.remove("mp-custom-room-active");
    };
  }, [inRoom]);

  useEffect(
    () =>
      subscribeToSocket(() => {
        setSocketIdentityId(getSocketIdentityId());
      }),
    [],
  );

  useEffect(() => {
    if (!autoStartEndsAt) return undefined;

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);
    setNowMs(Date.now());

    return () => window.clearInterval(intervalId);
  }, [autoStartEndsAt]);

  useEffect(() => {
    if (!routeRoomCode) {
      customRoomRouteVisited = true;
      autoJoinAttemptedCodeRef.current = "";
      leavingRoomRef.current = false;
      return;
    }

    const activeRoomCode = window.sessionStorage.getItem(
      CUSTOM_ACTIVE_ROOM_KEY,
    );

    if (activeRoomCode === routeRoomCode && !customRoomRouteVisited) {
      window.sessionStorage.removeItem(CUSTOM_ACTIVE_ROOM_KEY);
      navigate("/play/multiplayer/custom", { replace: true });
      customRoomRouteVisited = true;
      return;
    }

    customRoomRouteVisited = true;
  }, [navigate, routeRoomCode]);

  const currentPlayer = useMemo<CustomRoomPlayer | null>(() => {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      isHost: true,
    };
  }, [user]);

  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      return undefined;
    }

    const handleRoomUpdate = (snapshot: CustomRoomSnapshot) => {
      if (leavingRoomRef.current) return;

      const nextRoomCode = snapshot.roomCode ?? snapshot.roomId ?? "";

      setRoomId(snapshot.roomId ?? "pending-custom-room");
      setRoomStatus(snapshot.status ?? "lobby");
      setAutoStartEndsAt(snapshot.autoStartEndsAt ?? null);
      setRoomCode(nextRoomCode);
      if (nextRoomCode) {
        window.sessionStorage.setItem(CUSTOM_ACTIVE_ROOM_KEY, nextRoomCode);
      }
      setPlayers(snapshot.players ?? (currentPlayer ? [currentPlayer] : []));
      if (snapshot.config) {
        setConfig(snapshot.config);
        setSavedConfigJson(JSON.stringify(snapshot.config));
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          showToast("Room settings saved for the next game.", "success");
        }
      }
      setChatMessages(
        (snapshot.chatMessages ?? []).map((message, index) =>
          normalizeChatMessage(message, index),
        ),
      );
      setStatus("");

      if (nextRoomCode && location.pathname !== customRoomPath(nextRoomCode)) {
        navigate(customRoomPath(nextRoomCode), { replace: true });
      }
    };

    const handleChatMessage = (data: {
      actor?: string;
      id?: string;
      message?: string;
      sender?: string;
      system?: boolean;
    }) => {
      if (leavingRoomRef.current) return;

      setChatMessages((current) => [
        ...current,
        {
          id: data.id ?? `${Date.now()}-${current.length}`,
          author: data.sender ?? "PLAYER",
          actor: data.actor,
          system: data.system,
          text: data.message ?? "",
        },
      ]);
    };

    const handleError = (error: ServerError) => {
      if (leavingRoomRef.current) return;

      const message = error.reason ?? "SERVER ERROR";
      pendingSaveRef.current = false;
      setStatus(message);
      showToast(message, "error");
    };

    const handleGameStart = (payload: GameStartPayload) => {
      if (payload.config?.mode !== "custom") return;

      const nextRoomId = payload.roomId ?? roomId;
      const isActivePlayer =
        !!currentIdentityId && !!payload.players?.[String(currentIdentityId)];
      const shouldSpectate = currentRoomRole === "spectator";

      if (!nextRoomId || (!isActivePlayer && !shouldSpectate)) return;

      setAutoStartEndsAt(null);
      navigate(`/game/${nextRoomId}`, {
        state: {
          ...payload,
          from: customRoomPath(roomCode || nextRoomId),
        },
      });
    };

    socket.on("room:update", handleRoomUpdate);
    socket.on("chat:message", handleChatMessage);
    socket.on("server:error", handleError);
    socket.on("game:start", handleGameStart);

    return () => {
      socket.off("room:update", handleRoomUpdate);
      socket.off("chat:message", handleChatMessage);
      socket.off("server:error", handleError);
      socket.off("game:start", handleGameStart);
    };
  }, [
    currentIdentityId,
    currentRoomRole,
    currentPlayer,
    location.pathname,
    navigate,
    roomCode,
    roomId,
    showToast,
  ]);

  useEffect(() => {
    if (
      !routeRoomCode ||
      leavingRoomRef.current ||
      inRoom ||
      autoJoinAttemptedCodeRef.current === routeRoomCode
    ) {
      return;
    }

    autoJoinAttemptedCodeRef.current = routeRoomCode;
    getSocket()?.emit("mode:join", {
      mode: "custom",
      payload: {
        roomConfig: {
          roomName: `JOIN:${routeRoomCode}`, //no need to send on mode:join (only in the room on modification, later!)
        },
      },
    });
  }, [inRoom, routeRoomCode]);

  const updateRoom = (nextRoomConfig: Partial<CustomRoomConfig>) => {
    setConfig((current) => ({
      ...current,
      roomConfig: {
        ...current.roomConfig,
        ...nextRoomConfig,
      },
    }));
  };

  const updateMatch = (nextMatchConfig: Partial<MatchConfig>) => {
    setConfig((current) => ({
      ...current,
      matchConfig: {
        ...DEFAULT_MATCH_CONFIG,
        ...(current.matchConfig ?? {}),
        ...nextMatchConfig,
      },
    }));
  };

  const updateGeneral = (nextGeneralConfig: Partial<GeneralConfig>) => {
    setConfig((current) => ({
      ...current,
      gameConfig: {
        ...current.gameConfig,
        general: {
          ...current.gameConfig.general,
          ...nextGeneralConfig,
        },
      },
    }));
  };

  const updateControls = (nextControlsConfig: Partial<ControlsConfig>) => {
    setConfig((current) => ({
      ...current,
      gameConfig: {
        ...current.gameConfig,
        controls: {
          ...current.gameConfig.controls,
          ...nextControlsConfig,
        },
      },
    }));
  };

  const updateGravity = (nextGravityConfig: Partial<GravityConfig>) => {
    setConfig((current) => ({
      ...current,
      gameConfig: {
        ...current.gameConfig,
        gravity: {
          ...current.gameConfig.gravity,
          ...nextGravityConfig,
        },
      },
    }));
  };

  const updateGarbage = (nextGarbageConfig: Partial<GarbageConfig>) => {
    setConfig((current) => ({
      ...current,
      gameConfig: {
        ...current.gameConfig,
        garbage: {
          ...current.gameConfig.garbage,
          ...nextGarbageConfig,
        },
      },
    }));
  };

  const createRoom = (visibility: Visibility) => {
    leavingRoomRef.current = false;

    if (visibility === "public" && !capabilities.canCreatePublicRooms) {
      setStatus("REGISTERED USERS ONLY");
      return;
    }

    if (visibility === "private" && !capabilities.canCreatePrivateRooms) {
      setStatus("SIGN IN REQUIRED");
      return;
    }

    const nextConfig = {
      ...config,
      roomConfig: {
        ...config.roomConfig,
        public: visibility === "public",
        roomName:
          (
            config.roomConfig.roomName?.trim() ||
            (user ? `${user.username}'S ${visibility.toUpperCase()} ROOM` : "")
          ).toUpperCase(),
      },
    };

    setConfig(nextConfig);
    setSavedConfigJson(JSON.stringify(nextConfig));
    setRoomId("pending-custom-room");
    setRoomStatus("lobby");
    setAutoStartEndsAt(null);
    setRoomCode("");
    setPlayers(currentPlayer ? [currentPlayer] : []);
    setTab("room");
    setStatus("CREATING ROOM");

    getSocket()?.emit("mode:join", {
      mode: "custom",
      payload: createBackendConfigPatch(nextConfig),
    });
  };

  const saveConfig = () => {
    pendingSaveRef.current = true;
    setStatus("SAVING ROOM SETTINGS");
    getSocket()?.emit("room:updateConfig", createBackendConfigPatch(config));
  };

  const startGame = async () => {
    if (isConfigDirty) {
      const approved = await confirm({
        title: "Unsaved room settings",
        message: "Changes are not saved. Discard them and start the game?",
        confirmLabel: "DISCARD AND PLAY",
      });
      if (!approved) return;
    }

    setStatus("STARTING");
    getSocket()?.emit("room:start");
  };

  const sendChatMessage = () => {
    if (!chatMessage.trim()) {
      return;
    }

    getSocket()?.emit("chat:message", { message: chatMessage.trim() });
    setChatMessage("");
  };

  const leaveRoom = async () => {
    const approved = await confirm({
      title: "Leave custom room?",
      message: "You will leave the current lobby and its chat.",
      confirmLabel: "LEAVE ROOM",
    });
    if (!approved) return;

    leavingRoomRef.current = true;
    if (roomCode || routeRoomCode || roomId) {
      autoJoinAttemptedCodeRef.current =
        roomCode || routeRoomCode || roomId || "";
    }
    if (roomId) {
      getSocket()?.emit("mode:leave");
    }

    setRoomId(null);
    setRoomStatus("lobby");
    setAutoStartEndsAt(null);
    setRoomCode("");
    setPlayers([]);
    setChatMessages([]);
    setStatus("");
    window.sessionStorage.removeItem(CUSTOM_ACTIVE_ROOM_KEY);
    navigate("/play/multiplayer/custom", { replace: true });
  };

  const copyRoomUrl = async () => {
    if (!copyableRoomCode) {
      return;
    }

    const inviteUrl = `${window.location.origin}/play/multiplayer/custom/${copyableRoomCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus("ROOM URL COPIED");
      showToast("Room URL copied.", "success");
    } catch {
      setStatus("COULD NOT COPY ROOM URL");
      showToast("Could not copy the room URL.", "error");
    }
  };

  const spectateActiveGame = () => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const handleResume = (payload: GameStartPayload) => {
      if (payload.roomId !== roomId) return;

      socket.off("game:resume", handleResume);
      navigate(`/game/${roomId}`, {
        state: {
          ...payload,
          from: customRoomPath(roomCode || roomId),
        },
      });
    };

    socket.on("game:resume", handleResume);
    socket.emit("game:resume");
  };

  const playZenWhileWaiting = () => {
    const socket = getSocket();
    const preset = getStoredGameConfig()?.solo.presets.zen;

    if (!socket) {
      showToast("Socket is not connected yet.", "error");
      return;
    }

    if (!preset) {
      showToast("Game config is not loaded yet.", "error");
      return;
    }

    const returnPath = customRoomPath(roomCode || roomId || "");
    const handleGameStart = (payload: GameStartPayload) => {
      if (payload.config?.mode !== "solo" || !payload.roomId) return;

      socket.off("server:error", handleModeError);
      navigate(`/game/${payload.roomId}`, {
        state: {
          ...payload,
          from: returnPath,
        },
      });
    };
    const handleModeError = (error: ServerError) => {
      socket.off("game:start", handleGameStart);
      showToast(error.reason ?? "Failed to start Zen.", "error");
    };

    socket.off("game:start", handleGameStart);
    socket.off("server:error", handleModeError);
    socket.once("game:start", handleGameStart);
    socket.once("server:error", handleModeError);
    socket.emit("mode:join", {
      mode: "solo",
      payload: {
        gameConfig: {
          mode: "solo",
          preset: "zen",
          objective: preset.objective,
        },
      },
    });
  };

  const switchRoomRole = () => {
    const nextRole = currentRoomRole === "spectator" ? "player" : "spectator";
    getSocket()?.emit("room:switchRole", { role: nextRole });
  };

  const profileUser = (player: CustomRoomPlayer): SessionUser => {
    const numericId = Number(player.id);
    const isAnonymous = !Number.isInteger(numericId) || numericId <= 0;

    return {
      id: isAnonymous ? 0 : numericId,
      email: "",
      username: player.username,
      created_at: null,
      isAnonymous,
      avatarId: 0,
    };
  };

  const sendFriendAction = async (
    player: CustomRoomPlayer,
    action: "request" | "block",
  ) => {
    const targetId = Number(player.id);
    if (!Number.isInteger(targetId) || targetId <= 0 || user?.isAnonymous) {
      showToast("Registered users only.", "error");
      return;
    }

    try {
      const response = await authFetch(`/api/friends/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: targetId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        throw new Error(payload?.error ?? payload?.message ?? "Action failed");
      }

      showToast(
        action === "request"
          ? `Friend request sent to ${player.username}.`
          : `${player.username} blocked.`,
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Action failed", "error");
    }
  };

  if (!inRoom) {
    return (
      <section className="mp-page mp-page--custom-select">
        <button
          className="mp-back"
          onClick={() => navigate("/play/multiplayer")}
          type="button"
        >
          BACK
        </button>

        <main className="mp-custom-picker" aria-label="Custom room visibility">
          {status && <div className="mp-access-notice">{status}</div>}
          <button
            className="mp-custom-pick"
            disabled={!capabilities.canCreatePublicRooms}
            onClick={() => createRoom("public")}
            type="button"
          >
            <span>PUBLIC ROOM</span>
            <small>CREATE A PUBLIC ROOM ANYONE CAN JOIN</small>
          </button>
          <button
            className="mp-custom-pick"
            disabled={!capabilities.canCreatePrivateRooms}
            onClick={() => createRoom("private")}
            type="button"
          >
            <span>PRIVATE ROOM</span>
            <small>CREATE A PRIVATE ROOM FOR YOU AND FRIENDS</small>
          </button>
        </main>
      </section>
    );
  }

  return (
    <>
      {headerContent &&
        createPortal(
          <div className="mp-custom-header-controls">
            <button
              className="mp-custom-exit"
              onClick={leaveRoom}
              type="button"
            >
              EXIT
            </button>
            <button
              className="mp-custom-code"
              disabled={!copyableRoomCode}
              onClick={copyRoomUrl}
              type="button"
            >
              <small>CLICK TO COPY URL</small>
              {copyableRoomCode || "WAITING FOR ROOM CODE"}
            </button>
          </div>,
          headerContent,
        )}

      <section className="mp-custom-room">
        <aside className="mp-custom-players">
          <h2>PLAYERS ({activeRoomPlayers.length})</h2>
          <div className="mp-custom-player-list">
            {players.map((player) => (
              <button
                className={`mp-custom-player ${
                  player.role === "spectator"
                    ? "mp-custom-player--spectator"
                    : ""
                }`}
                key={player.id}
                onClick={() => setProfilePlayer(player)}
                type="button"
              >
                <strong>{player.username}</strong>
                <span>
                  {player.matchWins ?? 0}/{player.matchTotalGames ?? 0}
                </span>
                <div className="mp-custom-player-badges">
                  {player.isHost && <em>HOST</em>}
                  {player.role === "spectator" && <em>SPECTATOR</em>}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="mp-custom-main">
          <h1>{roomName}</h1>
          <nav className="mp-custom-tabs" aria-label="Custom room settings">
            {(["room", "match", "game"] as CustomTab[]).map(
              (nextTab) => (
                <button
                  className={tab === nextTab ? "is-active" : ""}
                  key={nextTab}
                  onClick={() => setTab(nextTab)}
                  type="button"
                >
                  {nextTab}
                </button>
              ),
            )}
          </nav>

          <section className="mp-custom-panel">
            {tab === "room" && (
              <div className="mp-custom-settings">
                <h2>GENERAL</h2>
                <TextField
                  {...settingProps}
                  hint={FIELD_HINTS.roomName}
                  label="ROOM NAME"
                  onChange={(value) => updateRoom({ roomName: value.toUpperCase() })}
                  value={config.roomConfig.roomName ?? ""}
                />
                <NumberField
                  {...settingProps}
                  hint={FIELD_HINTS.maxPlayers}
                  label="PLAYER LIMIT"
                  min={0}
                  onChange={(value) =>
                    updateRoom({ maxPlayers: value > 0 ? value : null })
                  }
                  value={config.roomConfig.maxPlayers ?? 0}
                />
                <NumberField
                  {...settingProps}
                  hint={FIELD_HINTS.autoStart}
                  label="AUTO START"
                  max={60}
                  min={0}
                  onChange={(value) => updateRoom({ autoStart: value })}
                  step={15}
                  value={config.roomConfig.autoStart ?? 0}
                />
                <ToggleField
                  {...settingProps}
                  checked={config.roomConfig.public}
                  hint={FIELD_HINTS.public}
                  label="PUBLIC ROOM"
                  onChange={(value) => updateRoom({ public: value })}
                />
                <ToggleField
                  {...settingProps}
                  checked={config.roomConfig.anonymousAllowed}
                  hint={FIELD_HINTS.anonymousAllowed}
                  label="ALLOW ANONYMOUS USERS TO JOIN"
                  onChange={(value) => updateRoom({ anonymousAllowed: value })}
                />
              </div>
            )}

            {tab === "match" && (
              <div className="mp-custom-settings">
                <h2>MATCH</h2>
                <NumberField
                  {...settingProps}
                  hint={FIELD_HINTS.roundsToWin}
                  label="ROUNDS TO WIN"
                  min={1}
                  onChange={(value) => updateMatch({ roundsToWin: value })}
                  value={config.matchConfig?.roundsToWin ?? 1}
                />
                <NumberField
                  {...settingProps}
                  hint={FIELD_HINTS.winByRounds}
                  label="WIN BY ROUNDS"
                  min={0}
                  onChange={(value) => updateMatch({ winByRounds: value })}
                  value={config.matchConfig?.winByRounds ?? 0}
                />
                <NumberField
                  {...settingProps}
                  hint={FIELD_HINTS.goldenPoint}
                  label="GOLDEN POINT"
                  min={0}
                  onChange={(value) => updateMatch({ goldenPoint: value })}
                  value={config.matchConfig?.goldenPoint ?? 0}
                />
                <NumberField
                  {...settingProps}
                  hint={FIELD_HINTS.stock}
                  label="STOCK"
                  min={0}
                  onChange={(value) => updateMatch({ stock: value })}
                  value={config.matchConfig?.stock ?? 0}
                />
              </div>
            )}

            {tab === "game" && (
              <div className="mp-custom-settings mp-custom-settings--columns">
                <section>
                  <h2>GAME</h2>
                  {isCurrentUserHost ? (
                    <label
                      className="mp-custom-setting"
                      data-hint={FIELD_HINTS.bagType}
                    >
                      <span>BAG TYPE</span>
                      <select
                        onChange={(event) =>
                          updateGeneral({ bagType: event.target.value })
                        }
                        value={config.gameConfig.general.bagType}
                      >
                        {BAG_TYPE_OPTIONS.map((bagType) => (
                          <option key={bagType} value={bagType}>
                            {bagType.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <ReadOnlyField
                      hint={FIELD_HINTS.bagType}
                      label="BAG TYPE"
                      value={config.gameConfig.general.bagType.toUpperCase()}
                    />
                  )}
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.boardWidth}
                    label="BOARD WIDTH"
                    max={20}
                    min={4}
                    onChange={(value) => updateGeneral({ boardWidth: value })}
                    value={config.gameConfig.general.boardWidth}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.boardHeight}
                    label="BOARD HEIGHT"
                    max={40}
                    min={10}
                    onChange={(value) => updateGeneral({ boardHeight: value })}
                    value={config.gameConfig.general.boardHeight}
                  />
                  <ToggleField
                    {...settingProps}
                    checked={config.gameConfig.controls.hold}
                    hint={FIELD_HINTS.hold}
                    label="HOLD"
                    onChange={(value) => updateControls({ hold: value })}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.nextPieces}
                    label="NEXT PIECES"
                    max={7}
                    min={0}
                    onChange={(value) => updateControls({ nextPieces: value })}
                    value={config.gameConfig.controls.nextPieces}
                  />
                  <ToggleField
                    {...settingProps}
                    checked={config.gameConfig.controls.showShadowPiece}
                    hint={FIELD_HINTS.showShadowPiece}
                    label="SHADOW PIECE"
                    onChange={(value) =>
                      updateControls({ showShadowPiece: value })
                    }
                  />
                </section>

                <section>
                  <h2>GRAVITY</h2>
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.lockDelay}
                    label="LOCK DELAY"
                    min={0}
                    onChange={(value) => updateGravity({ lockDelay: value })}
                    value={config.gameConfig.gravity.lockDelay}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.lockDelayDecrease}
                    label="LOCK DECREASE"
                    min={0}
                    onChange={(value) =>
                      updateGravity({ lockDelayDecrease: value })
                    }
                    step={0.1}
                    value={config.gameConfig.gravity.lockDelayDecrease}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.minimumLockDelay}
                    label="MIN LOCK DELAY"
                    min={0}
                    onChange={(value) =>
                      updateGravity({ minimumLockDelay: value })
                    }
                    value={config.gameConfig.gravity.minimumLockDelay}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.gravity}
                    label="GRAVITY"
                    min={0}
                    onChange={(value) => updateGravity({ gravity: value })}
                    step={0.01}
                    value={config.gameConfig.gravity.gravity}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.gravityIncrease}
                    label="GRAVITY INCREASE"
                    min={0}
                    onChange={(value) =>
                      updateGravity({ gravityIncrease: value })
                    }
                    step={0.0001}
                    value={config.gameConfig.gravity.gravityIncrease}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.gravitMarginTime}
                    label="GRAVITY MARGIN TIME"
                    min={0}
                    onChange={(value) =>
                      updateGravity({ gravitMarginTime: value })
                    }
                    value={config.gameConfig.gravity.gravitMarginTime}
                  />
                </section>

                <section>
                  <h2>GARBAGE</h2>
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.garbageMult}
                    label="GARBAGE MULT"
                    min={0}
                    onChange={(value) => updateGarbage({ garbageMult: value })}
                    step={0.1}
                    value={config.gameConfig.garbage.garbageMult}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.garbageCap}
                    label="GARBAGE CAP"
                    min={0}
                    onChange={(value) => updateGarbage({ garbageCap: value })}
                    value={config.gameConfig.garbage.garbageCap}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.garbageMaxCap}
                    label="GARBAGE MAX CAP"
                    min={0}
                    onChange={(value) =>
                      updateGarbage({ garbageMaxCap: value })
                    }
                    value={config.gameConfig.garbage.garbageMaxCap}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.allClearGarbage}
                    label="ALL CLEAR GARBAGE"
                    min={0}
                    onChange={(value) =>
                      updateGarbage({ allClearGarbage: value })
                    }
                    value={config.gameConfig.garbage.allClearGarbage}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.garbageDelay}
                    label="GARBAGE DELAY"
                    min={0}
                    onChange={(value) => updateGarbage({ garbageDelay: value })}
                    value={config.gameConfig.garbage.garbageDelay}
                  />
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.garbageDelayOnClear}
                    label="DELAY ON CLEAR"
                    min={0}
                    onChange={(value) =>
                      updateGarbage({ garbageDelayOnClear: value })
                    }
                    value={config.gameConfig.garbage.garbageDelayOnClear}
                  />
                  {isCurrentUserHost ? (
                    <label
                      className="mp-custom-setting"
                      data-hint={FIELD_HINTS.garbageTargeting}
                    >
                      <span>TARGETING</span>
                      <select
                        onChange={(event) =>
                          updateGarbage({
                            garbageTargeting: event.target
                              .value as GarbageConfig["garbageTargeting"],
                          })
                        }
                        value={config.gameConfig.garbage.garbageTargeting}
                      >
                        <option value="payback">PAYBACK</option>
                        <option value="even">EVEN</option>
                        <option value="random">RANDOM</option>
                      </select>
                    </label>
                  ) : (
                    <ReadOnlyField
                      hint={FIELD_HINTS.garbageTargeting}
                      label="TARGETING"
                      value={config.gameConfig.garbage.garbageTargeting.toUpperCase()}
                    />
                  )}
                  <NumberField
                    {...settingProps}
                    hint={FIELD_HINTS.garbageColumnChangeChance}
                    label="HOLE CHANGE CHANCE"
                    max={1}
                    min={0}
                    onChange={(value) =>
                      updateGarbage({ garbageColumnChangeChance: value })
                    }
                    step={0.05}
                    value={config.gameConfig.garbage.garbageColumnChangeChance}
                  />
                </section>
              </div>
            )}
          </section>

          {isCurrentUserHost && (
            <button
              className="mp-custom-save"
              onClick={saveConfig}
              type="button"
            >
              SAVE
            </button>
          )}
        </main>

        <aside className="mp-custom-chat">
          <h2>CHAT</h2>
          <div className="mp-custom-chat-log">
            <p>
              <strong>[SYS]</strong>: Welcome to chat! Please remember to be
              civil to your opponents.
            </p>
            {chatMessages.map((message) => (
              <p key={message.id}>
                <strong>[{message.author}]</strong>:{" "}
                {message.system && message.actor ? (
                  <>
                    <strong>{message.actor}</strong>: {message.text}
                  </>
                ) : (
                  message.text
                )}
              </p>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendChatMessage();
            }}
          >
            <input
              onChange={(event) => setChatMessage(event.target.value)}
              placeholder="message..."
              value={chatMessage}
            />
          </form>
        </aside>

        <footer className="mp-custom-footer">
          <button
            className={`mp-custom-role-toggle mp-custom-role-toggle--${currentRoomRole}`}
            onClick={switchRoomRole}
            type="button"
          >
            {currentRoomRole === "spectator" ? "SPECTATING" : "PLAYING"}
            <small>
              {currentRoomRole === "spectator"
                ? "switch to player mode"
                : "switch to spectating mode"}
            </small>
          </button>
          {roomStatus === "playing" ? (
            <>
              <button onClick={spectateActiveGame} type="button">
                SPECTATE
              </button>
              <button onClick={playZenWhileWaiting} type="button">
                ZEN
              </button>
            </>
          ) : isCurrentUserHost ? (
            <button onClick={startGame} type="button">
              <span>START</span>
              {autoStartRemainingSeconds !== null &&
                autoStartRemainingSeconds > 0 && (
                  <strong
                    className="mp-custom-autostart-count"
                    key={autoStartRemainingSeconds}
                  >
                    {autoStartRemainingSeconds}
                  </strong>
                )}
              <small>{activeRoomPlayers.length} PLAYER</small>
            </button>
          ) : null}
          <span>VERSUS KNOCKOUT</span>
        </footer>
      </section>
      {profilePlayer && (
        <div
          className="profileOverlay mp-custom-profile-overlay"
          onMouseDown={() => setProfilePlayer(null)}
        >
          <ProfileHeader
            user={profileUser(profilePlayer)}
            onClose={() => setProfilePlayer(null)}
          />
          {!user?.isAnonymous &&
            !profileUser(profilePlayer).isAnonymous &&
            String(profilePlayer.id) !== currentIdentityId && (
              <div
                className="mp-custom-profile-actions"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  onClick={() => void sendFriendAction(profilePlayer, "request")}
                  type="button"
                >
                  ADD FRIEND
                </button>
                <button
                  onClick={() => void sendFriendAction(profilePlayer, "block")}
                  type="button"
                >
                  BLOCK
                </button>
              </div>
            )}
        </div>
      )}
    </>
  );
}
