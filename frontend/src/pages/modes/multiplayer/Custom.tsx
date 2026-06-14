import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { userCapabilities } from "../../../auth/capabilities";
import { getSessionUser, subscribeToSession } from "../../../auth/session";
import {
  getStoredGameConfig,
} from "../../../socket/gameConfigStorage";
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
  RANK_OPTIONS,
  readCustomEditableConfig,
} from "./custom/config";
import { NumberField, TextField, ToggleField } from "./custom/fields";
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
  const [tab, setTab] = useState<CustomTab>("welcome");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState(() =>
    routeRoomCode ? "JOINING ROOM" : "",
  );
  const [config, setConfig] = useState<CustomEditableConfig>(() =>
    readCustomEditableConfig(getStoredGameConfig()),
  );
  const [players, setPlayers] = useState<CustomRoomPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<CustomChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [socketIdentityId, setSocketIdentityId] = useState(() =>
    getSocketIdentityId(),
  );

  const inRoom = roomId !== null;
  const roomName = config.roomConfig.roomName?.trim() || "CUSTOM ROOM";
  const currentIdentityId = socketIdentityId ?? (user ? String(user.id) : null);
  const isCurrentUserHost = players.some(
    (player) => player.isHost && String(player.id) === currentIdentityId,
  );

  useEffect(() => {
    document.body.classList.add("mp-custom-active");

    return () => {
      document.body.classList.remove("mp-custom-active");
    };
  }, []);

  useEffect(
    () =>
      subscribeToSocket(() => {
        setSocketIdentityId(getSocketIdentityId());
      }),
    [],
  );

  useEffect(() => {
    if (!routeRoomCode) {
      customRoomRouteVisited = true;
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

      const nextRoomCode = snapshot.roomCode ?? "";

      setRoomId(snapshot.roomId ?? "pending-custom-room");
      setRoomCode(nextRoomCode);
      if (nextRoomCode) {
        window.sessionStorage.setItem(CUSTOM_ACTIVE_ROOM_KEY, nextRoomCode);
      }
      setPlayers(snapshot.players ?? (currentPlayer ? [currentPlayer] : []));
      if (snapshot.config) {
        setConfig(snapshot.config);
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

      setStatus(error.reason ?? "SERVER ERROR");
    };

    const handleGameStart = (payload: GameStartPayload) => {
      const nextRoomId = payload.roomId ?? roomId;

      if (!nextRoomId) return;

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
  }, [currentPlayer, location.pathname, navigate, roomCode, roomId]);

  useEffect(() => {
    if (
      !routeRoomCode ||
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

  const leaveRoom = async () => {
    const approved = await confirm({
      title: "Leave custom room?",
      message: "You will leave the current lobby and its chat.",
      confirmLabel: "LEAVE ROOM",
    });
    if (!approved) return;

    leavingRoomRef.current = true;
    if (roomId) {
      getSocket()?.emit("mode:leave");
    }

    setRoomId(null);
    setRoomCode("");
    setPlayers([]);
    setChatMessages([]);
    setStatus("");
    window.sessionStorage.removeItem(CUSTOM_ACTIVE_ROOM_KEY);
    navigate("/play/multiplayer/custom", { replace: true });
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
    <section className="mp-custom-room">
      <header className="mp-custom-topbar">
        <button className="mp-custom-exit" onClick={leaveRoom} type="button">
          EXIT
        </button>
        <button
          className="mp-custom-code"
          disabled={!roomCode}
          onClick={async () => {
            if (!roomCode) {
              return;
            }

            const inviteUrl = `${window.location.origin}/play/multiplayer/custom/${roomCode}`;
            try {
              await navigator.clipboard.writeText(inviteUrl);
              setStatus("ROOM URL COPIED");
              showToast("Room URL copied.", "success");
            } catch {
              setStatus("COULD NOT COPY ROOM URL");
              showToast("Could not copy the room URL.", "error");
            }
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
              <span>
                {player.matchWins ?? 0}/{player.matchTotalGames ?? 0}
              </span>
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
                  max={20}
                  min={4}
                  onChange={(value) => updateGeneral({ boardWidth: value })}
                  value={config.gameConfig.general.boardWidth}
                />
                <NumberField
                  label="BOARD HEIGHT"
                  max={40}
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
                  max={7}
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

        {isCurrentUserHost && (
          <button
            className="mp-custom-save"
            onClick={saveConfig}
            type="button"
          >
            SAVE
          </button>
        )}
        {status && <div className="mp-custom-status">{status}</div>}
      </main>

      <aside className="mp-custom-chat">
        <h2>CHAT</h2>
        <div className="mp-custom-chat-log">
          <p>
            <strong>[SYS]</strong>: Welcome to chat! Please remember to be civil to your opponents.
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
        <button type="button">PLAYING</button>
        {isCurrentUserHost && (
          <button onClick={startGame} type="button">
            START
            <small>{players.length} PLAYER</small>
          </button>
        )}
        <span>VERSUS KNOCKOUT</span>
      </footer>
    </section>
  );
}
