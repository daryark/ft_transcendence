import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { userCapabilities } from "../../../auth/capabilities";
import { getSessionUser, subscribeToSession } from "../../../auth/session";
import {
  getStoredGameConfig,
  type GameConfigDTO,
} from "../../../socket/gameConfigStorage";
import { getSocket } from "../../../socket/socketClient";
import type {
  ControlsConfig,
  GarbageConfig,
  GeneralConfig,
  GravityConfig,
  MatchConfig,
  MultiplayerGameConfig,
  RoomConfig,
} from "../../../../shared/types/config.types";
import "./MultiplayerMode.scss";

type Visibility = "public" | "private";
type CustomTab = "welcome" | "room" | "match" | "game";

type CustomRoomConfig = RoomConfig & {
  autoStart?: number;
};

type CustomEditableConfig = {
  roomConfig: CustomRoomConfig;
  matchConfig?: MatchConfig;
  gameConfig: MultiplayerGameConfig;
};

type CustomRoomPlayer = {
  id: number | string;
  username: string;
  country?: string;
  rank?: string;
  isHost?: boolean;
};

type CustomChatMessage = {
  id: string;
  author: string;
  text: string;
};

type CustomRoomSnapshot = {
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  visibility?: Visibility;
  players?: CustomRoomPlayer[];
  config?: CustomEditableConfig;
  chatMessages?: CustomChatMessage[];
};

type ServerError = {
  reason?: string;
};

type ConfigPatch = {
  roomConfig?: Partial<RoomConfig>;
  matchConfig?: Partial<MatchConfig>;
  gameConfig?: Partial<MultiplayerGameConfig>;
};

const RANK_OPTIONS = [
  "",
  "D",
  "D+",
  "C-",
  "C",
  "C+",
  "B-",
  "B",
  "B+",
  "A-",
  "A",
  "A+",
  "S-",
  "S",
  "S+",
  "SS",
  "U",
  "X",
];

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  roundsToWin: 1,
  winByRounds: 0,
  goldenPoint: 0,
  stock: 0,
};

const DEFAULT_CUSTOM_CONFIG: CustomEditableConfig = {
  roomConfig: {
    roomName: "",
    public: true,
    maxPlayers: null,
    anonymousAllowed: true,
    unrankedAllowed: true,
    rankLimit: "",
    autoStart: 0,
  },
  matchConfig: DEFAULT_MATCH_CONFIG,
  gameConfig: {
    mode: "custom",
    general: {
      bagType: "7-bag",
      boardWidth: 10,
      boardHeight: 20,
    },
    controls: {
      hold: true,
      nextPieces: 5,
      showShadowPiece: true,
    },
    gravity: {
      lockDelay: 30,
      gravity: 0.02,
      gravityIncrease: 0.0007,
      gravitMarginTime: 10000,
    },
    garbage: {
      garbageMult: 1,
      garbageCap: 8,
      garbageMaxCap: 10,
      garbagePassthrough: true,
      allClearGarbage: 5,
      garbageDelay: 100,
      garbageDelayOnClear: 20,
    },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const finiteOrNull = (value: unknown): number | null => {
  if (typeof value !== "number") {
    return null;
  }

  return Number.isFinite(value) ? value : null;
};

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toStringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const readCustomEditableConfig = (
  storedConfig: GameConfigDTO | null,
): CustomEditableConfig => {
  const editable = storedConfig?.multiplayer.custom.editableConfig;

  if (!isRecord(editable)) {
    return DEFAULT_CUSTOM_CONFIG;
  }

  const sourceRoom = isRecord(editable.roomConfig) ? editable.roomConfig : {};
  const sourceMatch = isRecord(editable.matchConfig) ? editable.matchConfig : {};
  const sourceGame = isRecord(editable.gameConfig) ? editable.gameConfig : {};
  const sourceGeneral = isRecord(sourceGame.general) ? sourceGame.general : {};
  const sourceControls = isRecord(sourceGame.controls) ? sourceGame.controls : {};
  const sourceGravity = isRecord(sourceGame.gravity) ? sourceGame.gravity : {};
  const sourceGarbage = isRecord(sourceGame.garbage) ? sourceGame.garbage : {};

  return {
    roomConfig: {
      ...DEFAULT_CUSTOM_CONFIG.roomConfig,
      roomName: toStringValue(
        sourceRoom.roomName,
        DEFAULT_CUSTOM_CONFIG.roomConfig.roomName,
      ),
      public: toBoolean(sourceRoom.public, DEFAULT_CUSTOM_CONFIG.roomConfig.public),
      maxPlayers:
        finiteOrNull(sourceRoom.maxPlayers) ??
        DEFAULT_CUSTOM_CONFIG.roomConfig.maxPlayers,
      anonymousAllowed: toBoolean(
        sourceRoom.anonymousAllowed,
        DEFAULT_CUSTOM_CONFIG.roomConfig.anonymousAllowed,
      ),
      unrankedAllowed: toBoolean(
        sourceRoom.unrankedAllowed,
        DEFAULT_CUSTOM_CONFIG.roomConfig.unrankedAllowed,
      ),
      rankLimit: toStringValue(sourceRoom.rankLimit),
      levelLimit: finiteOrNull(sourceRoom.levelLimit) ?? undefined,
      autoStart: finiteOrNull(sourceRoom.autoStart) ?? 0,
    },
    matchConfig: {
      roundsToWin: toNumber(
        sourceMatch.roundsToWin,
        DEFAULT_MATCH_CONFIG.roundsToWin,
      ),
      winByRounds: toNumber(
        sourceMatch.winByRounds,
        DEFAULT_MATCH_CONFIG.winByRounds ?? 0,
      ),
      goldenPoint: toNumber(
        sourceMatch.goldenPoint,
        DEFAULT_MATCH_CONFIG.goldenPoint ?? 0,
      ),
      stock: toNumber(sourceMatch.stock, DEFAULT_MATCH_CONFIG.stock ?? 0),
    },
    gameConfig: {
      ...DEFAULT_CUSTOM_CONFIG.gameConfig,
      general: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.general,
        bagType: toStringValue(
          sourceGeneral.bagType,
          DEFAULT_CUSTOM_CONFIG.gameConfig.general.bagType,
        ),
        boardWidth: toNumber(
          sourceGeneral.boardWidth,
          DEFAULT_CUSTOM_CONFIG.gameConfig.general.boardWidth,
        ),
        boardHeight: toNumber(
          sourceGeneral.boardHeight,
          DEFAULT_CUSTOM_CONFIG.gameConfig.general.boardHeight,
        ),
      },
      controls: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.controls,
        hold: toBoolean(
          sourceControls.hold,
          DEFAULT_CUSTOM_CONFIG.gameConfig.controls.hold,
        ),
        nextPieces: toNumber(
          sourceControls.nextPieces,
          DEFAULT_CUSTOM_CONFIG.gameConfig.controls.nextPieces,
        ),
        showShadowPiece: toBoolean(
          sourceControls.showShadowPiece,
          DEFAULT_CUSTOM_CONFIG.gameConfig.controls.showShadowPiece,
        ),
      },
      gravity: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.gravity,
        lockDelay: toNumber(
          sourceGravity.lockDelay,
          DEFAULT_CUSTOM_CONFIG.gameConfig.gravity.lockDelay,
        ),
        gravity: toNumber(
          sourceGravity.gravity,
          DEFAULT_CUSTOM_CONFIG.gameConfig.gravity.gravity,
        ),
        gravityIncrease: toNumber(
          sourceGravity.gravityIncrease,
          DEFAULT_CUSTOM_CONFIG.gameConfig.gravity.gravityIncrease,
        ),
        gravitMarginTime: toNumber(
          sourceGravity.gravitMarginTime,
          DEFAULT_CUSTOM_CONFIG.gameConfig.gravity.gravitMarginTime,
        ),
      },
      garbage: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.garbage,
        garbageMult: toNumber(
          sourceGarbage.garbageMult,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.garbageMult,
        ),
        garbageCap: toNumber(
          sourceGarbage.garbageCap,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.garbageCap,
        ),
        garbageMaxCap: toNumber(
          sourceGarbage.garbageMaxCap,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.garbageMaxCap,
        ),
        garbagePassthrough: toBoolean(
          sourceGarbage.garbagePassthrough,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.garbagePassthrough,
        ),
        allClearGarbage: toNumber(
          sourceGarbage.allClearGarbage,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.allClearGarbage,
        ),
        garbageDelay: toNumber(
          sourceGarbage.garbageDelay,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.garbageDelay,
        ),
        garbageDelayOnClear: toNumber(
          sourceGarbage.garbageDelayOnClear,
          DEFAULT_CUSTOM_CONFIG.gameConfig.garbage.garbageDelayOnClear,
        ),
      },
    },
  };
};

const numberFromInput = (value: string, fallback: number) => {
  const next = Number(value);

  return Number.isFinite(next) ? next : fallback;
};

const compactObject = <T extends Record<string, unknown>>(object: T) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

const createBackendConfigPatch = (
  config: CustomEditableConfig,
  roomNameOverride?: string,
): ConfigPatch => {
  const rankLimit = config.roomConfig.rankLimit?.trim();
  const roomConfig = compactObject({
    roomName: roomNameOverride ?? config.roomConfig.roomName?.trim() ?? undefined,
    maxPlayers: config.roomConfig.maxPlayers ?? undefined,
    public: config.roomConfig.public,
    anonymousAllowed: config.roomConfig.anonymousAllowed,
    unrankedAllowed: config.roomConfig.unrankedAllowed,
    levelLimit: config.roomConfig.levelLimit,
    rankLimit: rankLimit || undefined,
  });

  return {
    roomConfig,
    matchConfig: config.matchConfig,
    gameConfig: config.gameConfig,
  };
};

function ToggleField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mp-custom-setting">
      <span>{label}</span>
      <button
        className={`mp-custom-toggle ${checked ? "is-on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        type="button"
      >
        {checked ? "ON" : "OFF"}
      </button>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mp-custom-setting">
      <span>{label}</span>
      <input
        min={min}
        onChange={(event) => onChange(numberFromInput(event.target.value, value))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mp-custom-setting mp-custom-setting--wide">
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}

export default function Custom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode: roomCodeParam } = useParams<{ roomCode?: string }>();
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const capabilities = userCapabilities(user);
  const [tab, setTab] = useState<CustomTab>("welcome");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState("");
  const [config, setConfig] = useState<CustomEditableConfig>(() =>
    readCustomEditableConfig(getStoredGameConfig()),
  );
  const [players, setPlayers] = useState<CustomRoomPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<CustomChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [autoJoinCode, setAutoJoinCode] = useState(() => {
    const room =
      roomCodeParam ?? new URLSearchParams(location.search).get("room");

    return room?.trim().toUpperCase() ?? "";
  });

  const inRoom = roomId !== null;
  const roomName = config.roomConfig.roomName?.trim() || "CUSTOM ROOM";

  useEffect(() => {
    document.body.classList.add("mp-custom-active");

    return () => {
      document.body.classList.remove("mp-custom-active");
    };
  }, []);

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
      setRoomId(snapshot.roomId ?? "pending-custom-room");
      setRoomCode(snapshot.roomCode ?? "");
      setPlayers(snapshot.players ?? (currentPlayer ? [currentPlayer] : []));
      if (snapshot.config) {
        setConfig(snapshot.config);
      }
      setChatMessages(snapshot.chatMessages ?? []);
      setStatus("");
    };

    const handleChatMessage = (data: { sender?: string; message?: string }) => {
      setChatMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          author: data.sender ?? "PLAYER",
          text: data.message ?? "",
        },
      ]);
    };

    const handleError = (error: ServerError) => {
      setStatus(error.reason ?? "SERVER ERROR");
    };

    const handleGameStart = (payload: { roomId?: string }) => {
      navigate(`/game/${payload.roomId ?? roomId}`, {
        state: { from: "/play/multiplayer/custom" },
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
  }, [currentPlayer, navigate, roomId]);

  useEffect(() => {
    if (!autoJoinCode || inRoom) {
      return;
    }

    setStatus("JOINING ROOM");
    getSocket()?.emit("mode:join", {
      mode: "custom",
      payload: {
        roomConfig: {
          roomName: `JOIN:${autoJoinCode}`,
        },
      },
    });
    setAutoJoinCode("");
  }, [autoJoinCode, inRoom]);

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
          config.roomConfig.roomName?.trim() ||
          (user ? `${user.username}'S ${visibility.toUpperCase()} ROOM` : ""),
      },
    };

    setConfig(nextConfig);
    setRoomId("pending-custom-room");
    setRoomCode("");
    setPlayers(currentPlayer ? [currentPlayer] : []);
    setTab("welcome");
    setStatus("CREATING ROOM");

    getSocket()?.emit("mode:join", {
      mode: "custom",
      payload: createBackendConfigPatch(nextConfig),
    });
  };

  const saveConfig = () => {
    setStatus("SAVING");
    getSocket()?.emit("room:updateConfig", createBackendConfigPatch(config));
  };

  const startGame = () => {
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

  const leaveRoom = () => {
    if (roomId) {
      getSocket()?.emit("mode:leave");
    }

    setRoomId(null);
    setRoomCode("");
    setPlayers([]);
    setChatMessages([]);
    setStatus("");
  };

  if (!inRoom) {
    return (
      <section className="mp-page mp-page--custom-select">
        <button className="mp-back" onClick={() => navigate(-1)} type="button">
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
    <section className="mp-custom-room">
      <header className="mp-custom-topbar">
        <button className="mp-custom-exit" onClick={leaveRoom} type="button">
          EXIT
        </button>
        <button
          className="mp-custom-code"
          disabled={!roomCode}
          onClick={() => {
            if (!roomCode) {
              return;
            }

            const inviteUrl = `${window.location.origin}/play/multiplayer/custom/${roomCode}`;
            navigator.clipboard?.writeText(inviteUrl);
            setStatus("ROOM URL COPIED");
          }}
          type="button"
        >
          <small>CLICK TO COPY URL</small>
          {roomCode || "WAITING FOR ROOM CODE"}
        </button>
      </header>

      <aside className="mp-custom-players">
        <h2>PLAYERS ({players.length})</h2>
        <div className="mp-custom-player-list">
          {players.map((player) => (
            <div className="mp-custom-player" key={player.id}>
              <strong>{player.username}</strong>
              <span>{player.rank ?? "-"}</span>
              {player.isHost && <em>HOST</em>}
            </div>
          ))}
        </div>
      </aside>

      <main className="mp-custom-main">
        <h1>{roomName}</h1>
        <nav className="mp-custom-tabs" aria-label="Custom room settings">
          {(["welcome", "room", "match", "game"] as CustomTab[]).map((nextTab) => (
            <button
              className={tab === nextTab ? "is-active" : ""}
              key={nextTab}
              onClick={() => setTab(nextTab)}
              type="button"
            >
              {nextTab}
            </button>
          ))}
        </nav>

        <section className="mp-custom-panel">
          {tab === "welcome" && (
            <div className="mp-custom-welcome">
              <h2>WELCOME TO TETRA.IO!</h2>
              <p>
                YOUR CURRENTLY SET KEYBINDS AND PLAYER SETTINGS SHOULD BE
                REQUESTED FROM THE PROFILE SETTINGS API.
              </p>
              <div className="mp-custom-bindings">
                <span>MOVE FALLING PIECE LEFT</span>
                <strong>LOAD FROM USER SETTINGS</strong>
                <span>MOVE FALLING PIECE RIGHT</span>
                <strong>LOAD FROM USER SETTINGS</strong>
                <span>SOFT DROP</span>
                <strong>LOAD FROM USER SETTINGS</strong>
                <span>HARD DROP</span>
                <strong>LOAD FROM USER SETTINGS</strong>
                <span>ROTATE COUNTERCLOCKWISE</span>
                <strong>LOAD FROM USER SETTINGS</strong>
                <span>ROTATE CLOCKWISE</span>
                <strong>LOAD FROM USER SETTINGS</strong>
                <span>SWAP HOLD PIECE</span>
                <strong>LOAD FROM USER SETTINGS</strong>
              </div>
              <button onClick={() => setTab("room")} type="button">
                GOT IT!
              </button>
            </div>
          )}

          {tab === "room" && (
            <div className="mp-custom-settings">
              <h2>GENERAL</h2>
              <TextField
                label="ROOM NAME"
                onChange={(value) => updateRoom({ roomName: value })}
                value={config.roomConfig.roomName ?? ""}
              />
              <NumberField
                label="PLAYER LIMIT"
                min={0}
                onChange={(value) =>
                  updateRoom({ maxPlayers: value > 0 ? value : null })
                }
                value={config.roomConfig.maxPlayers ?? 0}
              />
              <NumberField
                label="AUTO START"
                min={0}
                onChange={(value) => updateRoom({ autoStart: value })}
                value={config.roomConfig.autoStart ?? 0}
              />
              <ToggleField
                checked={config.roomConfig.public}
                label="PUBLIC ROOM"
                onChange={(value) => updateRoom({ public: value })}
              />
              <ToggleField
                checked={config.roomConfig.anonymousAllowed}
                label="ALLOW ANONYMOUS USERS TO JOIN"
                onChange={(value) => updateRoom({ anonymousAllowed: value })}
              />
              <ToggleField
                checked={config.roomConfig.unrankedAllowed}
                label="ALLOW UNRANKED USERS TO PLAY"
                onChange={(value) => updateRoom({ unrankedAllowed: value })}
              />
              <label className="mp-custom-setting">
                <span>RANK LIMIT</span>
                <select
                  onChange={(event) =>
                    updateRoom({ rankLimit: event.target.value })
                  }
                  value={config.roomConfig.rankLimit ?? ""}
                >
                  {RANK_OPTIONS.map((rank) => (
                    <option key={rank || "none"} value={rank}>
                      {rank || "NONE"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {tab === "match" && (
            <div className="mp-custom-settings">
              <h2>MATCH</h2>
              <NumberField
                label="ROUNDS TO WIN"
                min={1}
                onChange={(value) => updateMatch({ roundsToWin: value })}
                value={config.matchConfig?.roundsToWin ?? 1}
              />
              <NumberField
                label="WIN BY ROUNDS"
                min={0}
                onChange={(value) => updateMatch({ winByRounds: value })}
                value={config.matchConfig?.winByRounds ?? 0}
              />
              <NumberField
                label="GOLDEN POINT"
                min={0}
                onChange={(value) => updateMatch({ goldenPoint: value })}
                value={config.matchConfig?.goldenPoint ?? 0}
              />
              <NumberField
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
                <TextField
                  label="BAG TYPE"
                  onChange={(value) => updateGeneral({ bagType: value })}
                  value={config.gameConfig.general.bagType}
                />
                <NumberField
                  label="BOARD WIDTH"
                  min={4}
                  onChange={(value) => updateGeneral({ boardWidth: value })}
                  value={config.gameConfig.general.boardWidth}
                />
                <NumberField
                  label="BOARD HEIGHT"
                  min={4}
                  onChange={(value) => updateGeneral({ boardHeight: value })}
                  value={config.gameConfig.general.boardHeight}
                />
                <ToggleField
                  checked={config.gameConfig.controls.hold}
                  label="HOLD"
                  onChange={(value) => updateControls({ hold: value })}
                />
                <NumberField
                  label="NEXT PIECES"
                  min={0}
                  onChange={(value) => updateControls({ nextPieces: value })}
                  value={config.gameConfig.controls.nextPieces}
                />
                <ToggleField
                  checked={config.gameConfig.controls.showShadowPiece}
                  label="SHADOW PIECE"
                  onChange={(value) => updateControls({ showShadowPiece: value })}
                />
              </section>

              <section>
                <h2>GRAVITY</h2>
                <NumberField
                  label="LOCK DELAY"
                  min={0}
                  onChange={(value) => updateGravity({ lockDelay: value })}
                  value={config.gameConfig.gravity.lockDelay}
                />
                <NumberField
                  label="GRAVITY"
                  min={0}
                  onChange={(value) => updateGravity({ gravity: value })}
                  step={0.01}
                  value={config.gameConfig.gravity.gravity}
                />
                <NumberField
                  label="GRAVITY INCREASE"
                  min={0}
                  onChange={(value) => updateGravity({ gravityIncrease: value })}
                  step={0.0001}
                  value={config.gameConfig.gravity.gravityIncrease}
                />
                <NumberField
                  label="GRAVITY MARGIN TIME"
                  min={0}
                  onChange={(value) => updateGravity({ gravitMarginTime: value })}
                  value={config.gameConfig.gravity.gravitMarginTime}
                />
              </section>

              <section>
                <h2>GARBAGE</h2>
                <NumberField
                  label="GARBAGE MULT"
                  min={0}
                  onChange={(value) => updateGarbage({ garbageMult: value })}
                  step={0.1}
                  value={config.gameConfig.garbage.garbageMult}
                />
                <NumberField
                  label="GARBAGE CAP"
                  min={0}
                  onChange={(value) => updateGarbage({ garbageCap: value })}
                  value={config.gameConfig.garbage.garbageCap}
                />
                <NumberField
                  label="GARBAGE MAX CAP"
                  min={0}
                  onChange={(value) => updateGarbage({ garbageMaxCap: value })}
                  value={config.gameConfig.garbage.garbageMaxCap}
                />
                <ToggleField
                  checked={config.gameConfig.garbage.garbagePassthrough}
                  label="GARBAGE PASSTHROUGH"
                  onChange={(value) => updateGarbage({ garbagePassthrough: value })}
                />
                <NumberField
                  label="ALL CLEAR GARBAGE"
                  min={0}
                  onChange={(value) => updateGarbage({ allClearGarbage: value })}
                  value={config.gameConfig.garbage.allClearGarbage}
                />
                <NumberField
                  label="GARBAGE DELAY"
                  min={0}
                  onChange={(value) => updateGarbage({ garbageDelay: value })}
                  value={config.gameConfig.garbage.garbageDelay}
                />
                <NumberField
                  label="DELAY ON CLEAR"
                  min={0}
                  onChange={(value) =>
                    updateGarbage({ garbageDelayOnClear: value })
                  }
                  value={config.gameConfig.garbage.garbageDelayOnClear}
                />
              </section>
            </div>
          )}
        </section>

        <button className="mp-custom-save" onClick={saveConfig} type="button">
          SAVE
        </button>
        {status && <div className="mp-custom-status">{status}</div>}
      </main>

      <aside className="mp-custom-chat">
        <h2>CHAT</h2>
        <div className="mp-custom-chat-log">
          <p>Welcome to chat! Please remember to be civil to your opponents.</p>
          {chatMessages.map((message) => (
            <p key={message.id}>
              <strong>{message.author}</strong>: {message.text}
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
        <button type="button">PLAYING</button>
        <button onClick={startGame} type="button">
          START
          <small>{players.length} PLAYER</small>
        </button>
        <span>VERSUS KNOCKOUT</span>
      </footer>
    </section>
  );
}
