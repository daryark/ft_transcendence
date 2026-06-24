import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../../../socket/socketClient";
import { useToast } from "../../../components/Toast/ToastProvider";
import { authFetch } from "../../../auth/authFetch";
import { getSessionUser } from "../../../auth/session";
import "./MultiplayerMode.scss";

const QUICKPLAY_MODIFIERS_STORAGE_PREFIX = "tetra.quickplay.selectedModifiers";

const quickMods = [
  {
    id: "double-hole",
    label: "II",
    name: "DOUBLE HOLE",
    image: "/cards/Doublehole.png",
    description: "Garbage has two wells.",
  },
  {
    id: "no-hold",
    label: "H",
    name: "NO HOLD",
    image: "/cards/Nohold.png",
    description: "Hold queue is disabled.",
  },
  {
    id: "messier-garbage",
    label: "M",
    name: "MESSIER GARBAGE",
    image: "/cards/Messy.png",
    description: "Garbage is significantly messier.",
  },
  {
    id: "faster-gravity",
    label: "G",
    name: "FASTER GRAVITY",
    image: "/cards/Gravity.png",
    description: "The stack gets heavier faster.",
  },
] as const;

type QuickChatMessage = {
  id: string;
  author: string;
  actor?: string;
  floor?: number;
  floorName?: string;
  isPersonalBest?: boolean;
  meters?: number;
  system?: boolean;
  text: string;
  variant?: string;
};

type QuickLobbyPlayer = {
  id: string | number;
  username?: string;
  quickplayMeters?: number;
};

type QuickResultState = {
  reason?: string;
  quickplay?: {
    meters: number;
    floor: number;
    floorName?: string;
    previousBestMeters: number | null;
    isPersonalBest: boolean;
    modifiers?: string[];
  };
  stats?: {
    elapsedMs?: number;
    lines?: number;
    piecesPlaced?: number;
    score?: number;
  };
};

type QuickPlayProfilePayload = {
  modes?: {
    quickPlay?: {
      value?: string;
    } | null;
  };
  profile?: {
    modes?: {
      quickPlay?: {
        value?: string;
      } | null;
    };
  };
};

function readQuickResultState(state: unknown): QuickResultState | null {
  if (!state || typeof state !== "object") return null;

  const quickplayResult = (state as { quickplayResult?: QuickResultState })
    .quickplayResult;
  return quickplayResult?.quickplay ? quickplayResult : null;
}

function formatElapsedTime(elapsedMs?: number) {
  const totalSeconds = Math.max(0, Math.floor((elapsedMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatMeters(meters: number) {
  return `${meters.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} m`;
}

function readMeters(value: string | null) {
  if (!value) return null;

  const meters = Number(value.replace(/,/g, "").replace(/\s*m$/i, ""));
  return Number.isFinite(meters) ? meters : null;
}

function getUpdatedQuickplayBest(
  current: string | null,
  result: QuickResultState | null,
) {
  const resultMeters = result?.quickplay?.meters;

  if (typeof resultMeters !== "number" || !Number.isFinite(resultMeters)) {
    return current;
  }

  const currentMeters = readMeters(current);
  return currentMeters !== null && currentMeters >= resultMeters
    ? current
    : formatMeters(resultMeters);
}

function getQuickResultKey(result: QuickResultState | null) {
  if (!result?.quickplay) return "";

  return [
    result.quickplay.meters.toFixed(1),
    result.quickplay.floor,
    result.stats?.elapsedMs ?? 0,
    result.stats?.piecesPlaced ?? 0,
  ].join(":");
}

function normalizeModifierIds(modifiers: unknown): string[] {
  if (!Array.isArray(modifiers)) return [];

  const allowed = new Set<string>(quickMods.map((modifier) => modifier.id));
  return modifiers.filter((modifier): modifier is string =>
    typeof modifier === "string" && allowed.has(modifier),
  );
}

function getQuickplayModifierStorageKey() {
  const user = getSessionUser();
  const identity = user
    ? user.isAnonymous
      ? `anon:${user.id}:${user.username}`
      : `user:${user.id}`
    : "guest";

  return `${QUICKPLAY_MODIFIERS_STORAGE_PREFIX}:${identity}`;
}

function clearStoredQuickplayModifiers() {
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(`${QUICKPLAY_MODIFIERS_STORAGE_PREFIX}:`)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

function normalizeQuickChatMessage(
  message: {
    actor?: string;
    floor?: number;
    floorName?: string;
    id?: string;
    isPersonalBest?: boolean;
    message?: string;
    meters?: number;
    sender?: string;
    system?: boolean;
    text?: string;
    variant?: string;
  },
  index: number,
): QuickChatMessage {
  return {
    id: message.id ?? `${Date.now()}-${index}`,
    author: message.sender ?? "PLAYER",
    actor: message.actor,
    floor: message.floor,
    floorName: message.floorName,
    isPersonalBest: message.isPersonalBest,
    meters: message.meters,
    system: message.system,
    text: message.text ?? message.message ?? "",
    variant: message.variant,
  };
}

async function fetchQuickplayBest(signal: AbortSignal) {
  const user = getSessionUser();

  if (!user || user.isAnonymous) return null;

  const response = await authFetch(
    `/api/users/${encodeURIComponent(user.username)}/profile`,
    { signal },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as QuickPlayProfilePayload;
  const profile = payload.profile ?? payload;

  return profile.modes?.quickPlay?.value ?? null;
}

export default function Quick() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [selectedMods, setSelectedMods] = useState<string[]>(() => {
    try {
      const saved = window.sessionStorage.getItem(getQuickplayModifierStorageKey());
      const parsed = saved ? JSON.parse(saved) : [];
      return normalizeModifierIds(parsed);
    } catch {
      return [];
    }
  });
  const [chatMessages, setChatMessages] = useState<QuickChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [climbers, setClimbers] = useState<QuickLobbyPlayer[]>([]);
  const [waitingStatus, setWaitingStatus] = useState("");
  const [submittedMods, setSubmittedMods] = useState<string[] | null>(null);
  const [hiddenResultKey, setHiddenResultKey] = useState("");
  const [sentResultKey, setSentResultKey] = useState("");
  const [quickplayBest, setQuickplayBest] = useState<string | null>(null);
  const waitingToastShownRef = useRef("");
  const pendingGameStartHandlerRef = useRef<((payload: { roomId?: string }) => void) | null>(
    null,
  );
  const routeResult = readQuickResultState(location.state);
  const routeResultKey = getQuickResultKey(routeResult);
  const lastResult =
    routeResult && routeResultKey !== hiddenResultKey ? routeResult : null;
  const currentResultKey = getQuickResultKey(lastResult);
  const resultSent = Boolean(currentResultKey && currentResultKey === sentResultKey);
  const resultSelectedMods = Array.isArray(lastResult?.quickplay?.modifiers)
    ? normalizeModifierIds(lastResult.quickplay.modifiers)
    : null;
  const visibleSelectedMods =
    submittedMods ?? (resultSelectedMods !== null ? resultSelectedMods : selectedMods);
  const displayedQuickplayBest = getUpdatedQuickplayBest(
    quickplayBest,
    routeResult,
  );

  useEffect(() => {
    document.body.classList.add("mp-quick-active");

    return () => {
      document.body.classList.remove("mp-quick-active");
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchQuickplayBest(controller.signal)
      .then((best) => {
        if (!controller.signal.aborted) {
          setQuickplayBest(best);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setQuickplayBest(null);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(
      getQuickplayModifierStorageKey(),
      JSON.stringify(visibleSelectedMods),
    );
  }, [visibleSelectedMods]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleRoomUpdate = (snapshot: {
      roomId?: string;
      players?: number;
      waitingFor?: number;
      chatMessages?: Array<Parameters<typeof normalizeQuickChatMessage>[0]>;
    }) => {
      if (!snapshot.waitingFor) return;

      setWaitingStatus(
        `Need ${snapshot.waitingFor} players. Waiting for pool to start.`,
      );
      setChatMessages(
        (snapshot.chatMessages ?? []).map((message, index) =>
          normalizeQuickChatMessage(message, index),
        ),
      );

      if (waitingToastShownRef.current !== snapshot.roomId) {
        waitingToastShownRef.current = snapshot.roomId ?? "quickplay";
        showToast("Need two players. Waiting for pool to start.", "info");
      }
    };
    const handleQuickplayLobby = (snapshot: {
      players?: QuickLobbyPlayer[];
      chatMessages?: Array<Parameters<typeof normalizeQuickChatMessage>[0]>;
    }) => {
      setClimbers(snapshot.players ?? []);
      setChatMessages(
        (snapshot.chatMessages ?? []).map((message, index) =>
          normalizeQuickChatMessage(message, index),
        ),
      );
    };

    const handleChatMessage = (data: Parameters<typeof normalizeQuickChatMessage>[0]) => {
      setChatMessages((current) => [
        ...current,
        normalizeQuickChatMessage(data, current.length),
      ]);
    };
    const handleDisconnect = () => {
      clearStoredQuickplayModifiers();
      setSelectedMods([]);
      setSubmittedMods(null);
    };

    socket.on("room:update", handleRoomUpdate);
    socket.on("quickplay:lobby", handleQuickplayLobby);
    socket.on("chat:message", handleChatMessage);
    socket.on("disconnect", handleDisconnect);
    socket.emit("quickplay:lobby");

    return () => {
      if (pendingGameStartHandlerRef.current) {
        socket.off("game:start", pendingGameStartHandlerRef.current);
        pendingGameStartHandlerRef.current = null;
      }
      socket.off("room:update", handleRoomUpdate);
      socket.off("quickplay:lobby", handleQuickplayLobby);
      socket.off("chat:message", handleChatMessage);
      socket.off("disconnect", handleDisconnect);
    };
  }, [showToast]);

  const toggleMod = (modifier: string) => {
    setHiddenResultKey(currentResultKey);
    setSubmittedMods(null);
    setSelectedMods(
      visibleSelectedMods.includes(modifier)
        ? visibleSelectedMods.filter((item) => item !== modifier)
        : [...visibleSelectedMods, modifier],
    );
  };

  const startQuickplay = () => {
    const socket = getSocket();
    if (!socket) return;

    setHiddenResultKey(currentResultKey);
    const modifiersToSubmit = visibleSelectedMods;
    setSubmittedMods(modifiersToSubmit);

    if (pendingGameStartHandlerRef.current) {
      socket.off("game:start", pendingGameStartHandlerRef.current);
      pendingGameStartHandlerRef.current = null;
    }

    const handleGameStart = (payload: { roomId?: string }) => {
      if (!payload.roomId) return;

      socket.off("game:start", handleGameStart);
      pendingGameStartHandlerRef.current = null;
      navigate(`/game/${payload.roomId}`, {
        replace: true,
        state: {
          ...payload,
          from: "/play/multiplayer/quick",
          quickplayPreviousResult: lastResult,
        },
      });
    };

    pendingGameStartHandlerRef.current = handleGameStart;
    socket.once("game:start", handleGameStart);
    socket.emit("mode:join", {
      mode: "quickplay",
      payload: {
        gameConfig: {
          mode: "quickplay",
          modifiers: modifiersToSubmit,
        },
      },
    });
  };

  const sendChatMessage = () => {
    const message = chatMessage.trim();
    if (!message) return;

    getSocket()?.emit("chat:message", { message });
    setChatMessage("");
  };

  const sendResultToChat = () => {
    const socket = getSocket();
    const quickplay = lastResult?.quickplay;
    if (!socket || !quickplay) return;

    const floor = quickplay.floorName ? ` on ${quickplay.floorName}` : "";
    const best = quickplay.isPersonalBest ? " New personal best!" : "";

    socket.emit("chat:message", {
      message: `Quick Play result: ${quickplay.meters.toFixed(1)}m${floor}.${best}`,
      quickplayResult: {
        floor: quickplay.floor,
        floorName: quickplay.floorName,
        isPersonalBest: quickplay.isPersonalBest,
        meters: quickplay.meters,
      },
    });
    setSentResultKey(currentResultKey);
    showToast("Result sent to Quick Play chat.", "success");
  };

  const spectateClimber = () => {
    const socket = getSocket();
    if (!socket) return;

    const handleGameStart = (payload: { roomId?: string }) => {
      if (!payload.roomId) return;

      socket.off("game:start", handleGameStart);
      navigate(`/game/${payload.roomId}`, {
        replace: true,
        state: {
          ...payload,
          from: "/play/multiplayer/quick",
        },
      });
    };

    socket.once("game:start", handleGameStart);
    socket.emit("quickplay:spectate");
  };

  return (
    <section className="mp-page mp-page--quick">
      <button
        className="mp-back"
        type="button"
        onClick={() => {
          clearStoredQuickplayModifiers();
          setSubmittedMods(null);
          navigate("/play/multiplayer");
        }}
      >
        EXIT
      </button>

      <main className="mp-quick-lobby" aria-label="Quick Play">
        <aside className="mp-quick-feed" aria-label="Quick Play feed">
          <div className="mp-quick-chat" aria-label="Quick Play chat">
            <div className="mp-quick-chat-log">
              <p>
                <strong>[SYS]</strong>: Welcome to Quick Play chat! Please remember to be civil.
              </p>
              <p>
                <strong>[SYS]</strong>: This chat is linked with the active tower.
              </p>
              {chatMessages.map((message) => (
                message.variant === "quickplay-result" ? (
                  <p
                    className={`quick-chat-result quick-chat-result--floor-${message.floor ?? 1}`}
                    key={message.id}
                  >
                    <strong>{message.author}</strong>
                    <span>{message.meters?.toFixed(1) ?? message.text}M</span>
                    <em>
                      {message.floorName ?? `Floor ${message.floor ?? 1}`}
                      {message.isPersonalBest ? " / new PB" : ""}
                    </em>
                  </p>
                ) : (
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
                )
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
          </div>
          <div className="mp-quick-mini-list" aria-label="Recent climbers">
            <span>{waitingStatus || "WAITING FOR CLIMBERS"}</span>
          </div>
        </aside>

        <section className="mp-quick-center">
          <article className="mp-card mp-quick-intro">
            {lastResult?.quickplay ? (
              <>
                <span className="mp-card__kicker">YOUR FINAL ALTITUDE</span>
                <h2>{lastResult.quickplay.meters.toFixed(1)}M</h2>
                <p>
                  {lastResult.quickplay.floorName ??
                    `Floor ${lastResult.quickplay.floor}`}
                </p>
                <div className="mp-quick-result-actions">
                  <span>
                    {lastResult.quickplay.isPersonalBest
                      ? "NEW PERSONAL BEST"
                      : lastResult.quickplay.previousBestMeters !== null
                        ? `PB ${lastResult.quickplay.previousBestMeters.toFixed(1)}M`
                        : "FIRST SAVED RESULT"}
                  </span>
                  <button
                    disabled={resultSent}
                    onClick={sendResultToChat}
                    type="button"
                  >
                    {resultSent ? "SENT!" : "SEND TO CHAT"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="mp-card__kicker">SPECTATE</span>
                <h2>QUICK PLAY</h2>
                <p>
                  Welcome to the Zenith Tower! Send lines and KO enemies to scale
                  the tower. The further up the tower, the stronger the opponents.
                </p>
                <p>Leaderboards reset every week. How far can you get?</p>
                <div className="mp-best">
                  Personal best
                  <strong>{displayedQuickplayBest ?? "NO RECORD"}</strong>
                </div>
              </>
            )}
          </article>

          <button className="mp-start mp-quick-start" onClick={startQuickplay} type="button">
            {lastResult ? "AGAIN" : "START"}
          </button>

          <div className="mp-mods" aria-label="Quick Play modifiers">
            <div className="mp-mod-stack">
              {quickMods.map((mod, index) => (
                <button
                  className={`mp-mod-card mp-mod-card--${index + 1}${
                    visibleSelectedMods.includes(mod.id) ? " is-selected" : ""
                  }`}
                  key={mod.id}
                  onClick={() => toggleMod(mod.id)}
                  title={mod.name}
                  type="button"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className="mp-mod-card__image"
                    loading="lazy"
                    src={mod.image}
                  />
                  <span className="mp-mod-card__badge">{mod.label}</span>
                  <span className="mp-mod-card__name">{mod.name}</span>
                  <span className="mp-mod-card__desc">{mod.description}</span>
                </button>
              ))}
            </div>
            <div className="mp-mod-footer">
              <strong>{visibleSelectedMods.length ? visibleSelectedMods.length : 0}</strong>
              <span>MODIFIERS SELECTED</span>
            </div>
          </div>

          {lastResult ? (
            <section className="mp-quick-run-stats" aria-label="Last run stats">
              <h2>LAST RUN</h2>
              <div>
                <span>TIME</span>
                <strong>{formatElapsedTime(lastResult.stats?.elapsedMs)}</strong>
              </div>
              <div>
                <span>LINES</span>
                <strong>{lastResult.stats?.lines ?? 0}</strong>
              </div>
              <div>
                <span>PIECES</span>
                <strong>{lastResult.stats?.piecesPlaced ?? 0}</strong>
              </div>
              <div>
                <span>SCORE</span>
                <strong>{lastResult.stats?.score ?? 0}</strong>
              </div>
            </section>
          ) : null}
        </section>

        <aside className="mp-quick-standings" aria-label="Quick Play standings">
          <strong>{climbers.length} PLAYING NOW</strong>
          {climbers.length > 0 ? (
            <div className="mp-quick-players">
              {climbers.map((player, index) => (
                <button
                  key={player.id}
                  onClick={spectateClimber}
                  type="button"
                >
                  <span>{index + 1}</span>
                  <strong>{player.username ?? "PLAYER"}</strong>
                  <em>{(player.quickplayMeters ?? 0).toFixed(1)}m</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="mp-quick-empty">NO ACTIVE CLIMBERS</div>
          )}
        </aside>
      </main>

    </section>
  );
}
