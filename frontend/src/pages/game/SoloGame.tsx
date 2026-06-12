import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import GameBoard from "../../components/GameBoard/GameBoard";
import MiniFigure from "../../components/MiniFigure/MiniFigure";
import {
  getSocket,
  subscribeToSocket,
} from "../../socket/socketClient";
import { getSessionUser } from "../../auth/session";
import MultiplayerGameOver from "./MultiplayerGameOver";
import type {
  GameConfig,
  ObjectiveConfig,
} from "../../../shared/types/config.types";
import type {
  GameEndPayload,
  GameStats,
  GameStartPayload,
  GameState,
  PlayerMove,
  PlayerMovePhase,
  VersusPlayerState,
} from "./types";
import "./SoloGame.scss";

const ACTIVE_GAME_KEY = "tetra-active-game";
const HORIZONTAL_REPEAT_DELAY_MS = 95;
const HORIZONTAL_REPEAT_MS = 42;
const INPUT_COOLDOWNS: Partial<Record<PlayerMove, number>> = {
  down: 40,
  rotate: 75,
  rotateCCW: 75,
  rotate180: 75,
  hold: 140,
  drop: 180,
};
const ESC_HOLD_MS = 2000;
const COUNTDOWN_NUMBERS = ["3", "2", "1", "GO"] as const;
const COUNTDOWN_STEP_MS = 900;
const TIME_WARNING_SECONDS = new Set([30, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);

type ActiveGamePayload = GameStartPayload & {
  from?: string;
  runStartedAt?: number;
};

type GameUpdatePayload = GameState | (GameStartPayload & { players: Record<string, VersusPlayerState> });

type CountdownStep =
  | "CLEAR 40 LINES!"
  | "TWO-MINUTE BLITZ"
  | (typeof COUNTDOWN_NUMBERS)[number]
  | null;

type SoloResult = {
  reason: GameEndPayload["reason"];
  stats: GameStats;
  winnerId?: GameEndPayload["winnerId"];
};

type SoloCountdownOverlayProps = {
  value: string;
  extension?: "number" | "warning";
};

function SoloCountdownOverlay({
  value,
  extension,
}: SoloCountdownOverlayProps) {
  const extensionClass =
    extension === "warning"
      ? " solo-game__countdown--number solo-game__countdown--warning"
      : extension === "number"
        ? " solo-game__countdown--number"
        : "";

  return (
    <div
      className={`solo-game__countdown${extensionClass}`}
      aria-live="polite"
    >
      {value}
    </div>
  );
}

const toActiveGamePayload = (value: unknown): Partial<ActiveGamePayload> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Partial<ActiveGamePayload>;
};

const isVersusPayload = (
  value: unknown,
): value is GameStartPayload & { players: Record<string, VersusPlayerState> } =>
  !!value &&
  typeof value === "object" &&
  "players" in value &&
  !!(value as { players?: unknown }).players;

function getInitialState(locationState: unknown) {
  const payload = locationState as GameStartPayload | null;

  if (payload?.state) {
    return payload.state;
  }

  try {
    const saved = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
    const parsed = saved ? toActiveGamePayload(JSON.parse(saved)) : null;

    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

function getInitialConfig(locationState: unknown) {
  const payload = locationState as GameStartPayload | null;

  if (payload?.config) {
    return payload.config;
  }

  try {
    const saved = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
    const parsed = saved ? toActiveGamePayload(JSON.parse(saved)) : null;

    return parsed?.config ?? null;
  } catch {
    return null;
  }
}

function getCountdownSequence(config: GameConfig | null): CountdownStep[] {
  if (config?.mode !== "solo") return [];

  if (config.preset === "40Lines") {
    return ["CLEAR 40 LINES!", ...COUNTDOWN_NUMBERS];
  }

  if (config.preset === "blitz") {
    return ["TWO-MINUTE BLITZ", ...COUNTDOWN_NUMBERS];
  }

  return [];
}

function getInitialCountdownStep(locationState: unknown) {
  const payload = locationState as GameStartPayload | null;

  if (!payload?.state) return null;

  return getCountdownSequence(payload.config ?? null)[0] ?? null;
}

function keyToMove(event: KeyboardEvent): PlayerMove | null {
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  if (event.key === "ArrowDown") return "down";
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") {
    return "rotate";
  }
  if (event.key.toLowerCase() === "z") return "rotateCCW";
  if (event.key === " ") return "drop";
  if (event.key.toLowerCase() === "c" || event.shiftKey) return "hold";

  return null;
}

function getSoloModeLabel(config: GameConfig | null) {
  if (config?.mode === "custom") return "VERSUS";
  if (config?.mode === "quickplay") return "QUICK PLAY";
  if (config?.mode === "league") return "LEAGUE";
  if (config?.mode !== "solo") return "SOLO";

  if (config.preset === "40Lines") return "40 LINES";
  if (config.preset === "blitz") return "BLITZ";
  if (config.preset === "zen") return "ZEN";

  return "SOLO";
}

function formatRunTime(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const minutes = Math.floor(safeMilliseconds / 60000);
  const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
  const centiseconds = Math.floor((safeMilliseconds % 1000) / 10);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
}

function getResultObjectiveStat(
  stats: GameStats,
  objectiveKey: ObjectiveConfig["key"] | undefined,
) {
  if (objectiveKey === "score") {
    return { label: "FINAL SCORE", value: `${stats.score}` };
  }

  if (objectiveKey === "lines") {
    return { label: "FINAL LINES", value: `${stats.lines}` };
  }

  return { label: "FINAL TIME", value: formatRunTime(stats.elapsedMs) };
}

function getResultBanner(
  reason: GameEndPayload["reason"],
  objective: ObjectiveConfig | null,
  modeLabel: string,
) {
  if (reason !== "objective_complete") return "RUN ENDED";

  if (objective?.winCondition === "lines") {
    return `${objective.linesToClear ?? 40} LINES CLEAR`;
  }

  if (objective?.winCondition === "time") {
    return "TIME UP";
  }

  if (objective?.winCondition === "score") {
    return `${objective.scoreToWin ?? "TARGET"} SCORE`;
  }

  return `${modeLabel} COMPLETE`;
}

function getObjectiveWarning(
  objective: ObjectiveConfig | null,
  stats: GameStats | undefined,
) {
  if (!objective || !stats?.objective) return null;

  if (objective.winCondition === "time") {
    const remainingMs = stats.objective.remaining ?? stats.remainingMs;
    if (remainingMs === null || remainingMs <= 0) return null;

    const remainingSeconds = Math.ceil(remainingMs / 1000);

    return TIME_WARNING_SECONDS.has(remainingSeconds)
      ? `${remainingSeconds}`
      : null;
  }

  if (objective.winCondition === "lines") {
    const target = stats.objective.target ?? objective.linesToClear ?? null;
    if (!target) return null;

    const remainingLines = Math.max(0, target - stats.objective.current);
    const lineWarnings = new Set([
      Math.ceil(target / 4),
      Math.ceil(target / 8),
      5,
      4,
      3,
      2,
      1,
    ]);

    return lineWarnings.has(remainingLines) ? `${remainingLines}` : null;
  }

  return null;
}

function getReturnPath(locationState: unknown) {
  return (
    toActiveGamePayload(locationState).from ??
    (() => {
      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = toActiveGamePayload(savedRaw ? JSON.parse(savedRaw) : null);

        return saved.from;
      } catch {
        return undefined;
      }
    })() ??
    "/play/solo/40lines"
  );
}

function formatVersusName(name: string | undefined, fallback: string) {
  const trimmed = name?.trim();

  if (!trimmed) return fallback;
  if (trimmed.length > 18 && trimmed.includes("-")) return fallback;
  if (trimmed.length > 18) return `${trimmed.slice(0, 15)}...`;

  return trimmed;
}

export default function SoloGame() {
  const { gameId } = useParams();
  const location = useLocation();
  const currentUser = getSessionUser();
  const currentUserId = currentUser ? String(currentUser.id) : null;
  const [gameState, setGameState] = useState<GameState | null>(() =>
    getInitialState(location.state),
  );
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(() =>
    getInitialConfig(location.state),
  );
  const [countdownStep, setCountdownStep] = useState<CountdownStep>(() =>
    getInitialCountdownStep(location.state),
  );
  const [runStartedAt, setRunStartedAt] = useState<number | null>(() => {
    try {
      const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
      const saved = toActiveGamePayload(savedRaw ? JSON.parse(savedRaw) : null);

      return saved.runStartedAt ?? null;
    } catch {
      return null;
    }
  });
  const [soloResult, setSoloResult] = useState<SoloResult | null>(null);
  const [versusPlayers, setVersusPlayers] = useState<
    Record<string, VersusPlayerState>
  >(() => {
    const payload = toActiveGamePayload(location.state);

    return payload.players ?? {};
  });
  const [socket, setSocket] = useState(() => getSocket());
  const [connectionStatus, setConnectionStatus] = useState(() =>
    getSocket() ? "CONNECTING" : "OFFLINE",
  );
  const lastInputAt = useRef<Partial<Record<PlayerMove, number>>>({});
  const horizontalRepeat = useRef<{
    key: "ArrowLeft" | "ArrowRight";
    timeoutId: number;
    intervalId: number | null;
  } | null>(null);
  const navigate = useNavigate();
  const gameStateRef = useRef<GameState | null>(gameState);
  const gameConfigRef = useRef<GameConfig | null>(gameConfig);
  const runStartedAtRef = useRef<number | null>(runStartedAt);
  const countdownStepRef = useRef<CountdownStep>(countdownStep);
  const inputLockedRef = useRef(Boolean(countdownStep));

  const [escProgress, setEscProgress] = useState(0);
  const escIntervalRef = useRef<number | null>(null);
  const escStartRef = useRef<number | null>(null);

  const objective = gameConfig?.mode === "solo" ? gameConfig.objective : null;
  const isZen = gameConfig?.mode === "solo" && gameConfig.preset === "zen";
  const targetLines =
    objective?.winCondition === "lines" ? objective.linesToClear ?? 40 : 40;
  const liveStats = gameState?.update;
  const elapsedMs = liveStats?.elapsedMs ?? 0;
  const displayTimeMs =
    liveStats?.remainingMs ?? elapsedMs;
  const piecesPerSecond = liveStats?.piecesPerSecond ?? 0;
  const lineProgress =
    liveStats?.objective?.type === "lines"
      ? `${liveStats.objective.current}/${liveStats.objective.target ?? targetLines}`
      : `${liveStats?.lines ?? 0}`;
  const primaryStat =
    objective?.key === "score"
      ? { label: "SCORE", value: `${liveStats?.score ?? 0}` }
      : { label: "LINES", value: lineProgress };
  const objectiveWarning = getObjectiveWarning(objective, liveStats);

  const modeLabel = getSoloModeLabel(gameConfig);
  const isVersus = gameConfig?.mode === "custom" && Object.keys(versusPlayers).length > 0;
  const versusEntries = Object.values(versusPlayers);
  const selfVersusPlayer =
    (currentUserId ? versusPlayers[currentUserId] : undefined) ?? versusEntries[0];
  const opponentVersusPlayers = versusEntries.filter(
    (player) => String(player.id) !== String(selfVersusPlayer?.id),
  );
  const primaryOpponent = opponentVersusPlayers[0];

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    gameConfigRef.current = gameConfig;
  }, [gameConfig]);

  useEffect(() => {
    runStartedAtRef.current = runStartedAt;
  }, [runStartedAt]);

  useEffect(() => {
    countdownStepRef.current = countdownStep;
    inputLockedRef.current = Boolean(countdownStep || soloResult);
  }, [countdownStep, soloResult]);

  useEffect(() => {
    if (!isVersus) {
      document.body.classList.remove("solo-versus-active");
      return undefined;
    }

    document.body.classList.add("solo-versus-active");

    return () => {
      document.body.classList.remove("solo-versus-active");
    };
  }, [isVersus]);

  useEffect(() => {
    return subscribeToSocket(() => {
      setSocket(getSocket());
    });
  }, []);

  useEffect(() => {
    if (!countdownStep) return undefined;

    const countdownSequence = getCountdownSequence(gameConfig);
    const currentIndex = countdownSequence.indexOf(countdownStep);

    if (currentIndex === -1) return undefined;

    const timeoutId = window.setTimeout(() => {
      const nextStep = countdownSequence[currentIndex + 1] ?? null;

      setCountdownStep(nextStep);

      if (!nextStep) {
        const startedAt = Date.now();

        setRunStartedAt(startedAt);
        try {
          const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
          const saved = toActiveGamePayload(savedRaw ? JSON.parse(savedRaw) : null);
          window.sessionStorage.setItem(
            ACTIVE_GAME_KEY,
            JSON.stringify({ ...saved, runStartedAt: startedAt }),
          );
        } catch {
          // ignore session storage failures
        }
      }
    }, COUNTDOWN_STEP_MS);

    return () => window.clearTimeout(timeoutId);
  }, [countdownStep, gameConfig]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleConnect = () => setConnectionStatus("LIVE");
    const handleDisconnect = () => setConnectionStatus("OFFLINE");
    const handleUpdate = (payload: GameUpdatePayload) => {
      setConnectionStatus("LIVE");
      if (countdownStepRef.current) return;

      const state = isVersusPayload(payload)
        ? payload.players[currentUserId ?? ""]?.state ??
        Object.values(payload.players)[0]?.state
        : payload;

      if (isVersusPayload(payload)) {
        setVersusPlayers(payload.players);
        setGameConfig(payload.config ?? gameConfigRef.current);
      }

      if (!state) return;

      setGameState(state);
      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = toActiveGamePayload(
          savedRaw ? JSON.parse(savedRaw) : null,
        );
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({
            roomId: gameId,
            state,
            config: isVersusPayload(payload)
              ? payload.config
              : saved?.config ?? gameConfigRef.current,
            players: isVersusPayload(payload) ? payload.players : saved?.players,
            runStartedAt: saved?.runStartedAt ?? runStartedAtRef.current,
            from: saved?.from,
          }),
        );
      } catch {
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state }),
        );
      }
    };
    const handleStart = (payload: ActiveGamePayload) => {
      if (payload.roomId !== gameId) return;
      setConnectionStatus("LIVE");
      const state = payload.players
        ? payload.players[currentUserId ?? ""]?.state ??
        Object.values(payload.players)[0]?.state
        : payload.state;

      setGameState(state);
      setGameConfig(payload.config ?? null);
      setVersusPlayers(payload.players ?? {});
      setSoloResult(null);
      const countdownSequence = getCountdownSequence(payload.config ?? null);
      const startedAt = state.startedAt;

      setRunStartedAt(startedAt);
      setCountdownStep(countdownSequence[0] ?? null);

      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = toActiveGamePayload(
          savedRaw ? JSON.parse(savedRaw) : null,
        );
        const from = payload.from ?? saved.from;
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({
            roomId: gameId,
            state,
            config: payload.config,
            players: payload.players,
            runStartedAt: startedAt,
            from,
          }),
        );
      } catch {
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state }),
        );
      }
    };
    const handleEnd = (payload: GameEndPayload) => {
      if (payload.roomId !== gameId) return;
      setConnectionStatus("ENDED");
      const state = payload.players
        ? payload.players[currentUserId ?? ""]?.state ??
        Object.values(payload.players)[0]?.state
        : payload.state;
      const nextState = state ?? gameStateRef.current;
      const stats = payload.result?.stats ?? nextState?.update;

      if (!nextState || !stats) return;

      setVersusPlayers(payload.players ?? {});
      setGameState(nextState);
      setSoloResult({
        reason: payload.reason,
        stats,
        winnerId: payload.winnerId,
      });
      setCountdownStep(null);
      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = toActiveGamePayload(
          savedRaw ? JSON.parse(savedRaw) : null,
        );
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({
            roomId: gameId,
            state: nextState,
            config: saved?.config ?? gameConfigRef.current,
            players: payload.players ?? saved?.players,
            runStartedAt: saved?.runStartedAt ?? runStartedAtRef.current,
            from: saved?.from,
          }),
        );
      } catch {
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state: nextState }),
        );
      }
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("game:update", handleUpdate);
    socket.on("game:start", handleStart);
    socket.on("game:end", handleEnd);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("game:update", handleUpdate);
      socket.off("game:start", handleStart);
      socket.off("game:end", handleEnd);
    };
  }, [currentUserId, gameId, socket]);

  // ESC hold handling
  useEffect(() => {
    if (!socket) return undefined;

    const clearEsc = () => {
      if (escIntervalRef.current) {
        window.clearInterval(escIntervalRef.current);
        escIntervalRef.current = null;
      }
      escStartRef.current = null;
      setEscProgress(0);
    };

    const startEsc = () => {
      if (escStartRef.current) return;
      escStartRef.current = window.performance.now();
      setEscProgress(0);
      escIntervalRef.current = window.setInterval(() => {
        const now = window.performance.now();
        const start = escStartRef.current ?? now;
        const progress = Math.min(1, (now - start) / ESC_HOLD_MS);
        setEscProgress(progress);
        if (progress >= 1) {
          // emit stop and navigate back
          socket.emit("game:stop");
          clearEsc();
          navigate(getReturnPath(location.state));
        }
      }, 100);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        startEsc();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearEsc();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clearEsc();
    };
  }, [socket, navigate, location.state]);

  useEffect(() => {
    if (!socket) return undefined;

    const emitMove = (
      move: PlayerMove,
      phase: PlayerMovePhase = "press",
      repeat = false,
    ) => {
      if (phase === "release") {
        socket.emit("player:move", { type: move, phase });
        return;
      }

      if (inputLockedRef.current) return;

      const cooldown = INPUT_COOLDOWNS[move] ?? 0;
      const now = window.performance.now();
      const lastAt = lastInputAt.current[move] ?? 0;

      if (now - lastAt < cooldown) return;

      lastInputAt.current[move] = now;
      socket.emit("player:move", { type: move, phase, repeat });
    };

    const stopHorizontalRepeat = (release = false) => {
      if (!horizontalRepeat.current) return;

      const move =
        horizontalRepeat.current.key === "ArrowLeft" ? "left" : "right";
      window.clearTimeout(horizontalRepeat.current.timeoutId);

      if (horizontalRepeat.current.intervalId !== null) {
        window.clearInterval(horizontalRepeat.current.intervalId);
      }

      horizontalRepeat.current = null;

      if (release) {
        emitMove(move, "release");
      }
    };

    const startHorizontalRepeat = (
      key: "ArrowLeft" | "ArrowRight",
      move: PlayerMove,
    ) => {
      if (horizontalRepeat.current?.key === key) return;

      stopHorizontalRepeat(true);
      emitMove(move);

      const timeoutId = window.setTimeout(() => {
        const intervalId = window.setInterval(() => {
          emitMove(move, "press", true);
        }, HORIZONTAL_REPEAT_MS);

        if (horizontalRepeat.current?.key === key) {
          horizontalRepeat.current.intervalId = intervalId;
        } else {
          window.clearInterval(intervalId);
        }
      }, HORIZONTAL_REPEAT_DELAY_MS);

      horizontalRepeat.current = {
        key,
        timeoutId,
        intervalId: null,
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (inputLockedRef.current || gameStateRef.current?.gameOver) return;

      const move = keyToMove(event);

      if (!move) return;

      event.preventDefault();

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        startHorizontalRepeat(event.key, move);
        return;
      }

      if (
        move === "rotate" ||
        move === "rotateCCW" ||
        move === "rotate180"
      ) {
        if (event.repeat) return;
      }

      if (move === "drop" && event.repeat) return;

      emitMove(move, "press", event.repeat);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        horizontalRepeat.current &&
        event.key === horizontalRepeat.current.key
      ) {
        stopHorizontalRepeat(true);
        return;
      }

      if (event.key === "ArrowDown") {
        emitMove("down", "release");
      }
    };

    const handleBlur = () => {
      stopHorizontalRepeat(true);
      emitMove("down", "release");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      stopHorizontalRepeat(true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [socket]);

  if (!gameState) {
    return (
      <main className="solo-game solo-game--empty">
        <p>Waiting for game state...</p>
        <Link className="solo-game__link" to="/play/solo">
          Back to Solo
        </Link>
      </main>
    );
  }

  if (isVersus && soloResult) {
    const returnPath = getReturnPath(location.state);
    return (
      <MultiplayerGameOver
        connectionStatus={connectionStatus}
        onNext={() => navigate(returnPath)}
        players={versusPlayers}
        reason={soloResult.reason}
        stats={soloResult.stats}
        winnerId={soloResult.winnerId}
      />
    );
  }

  if (isVersus) {
    const selfState = selfVersusPlayer?.state ?? gameState;
    const opponentState = primaryOpponent?.state ?? null;
    const renderVersusPlayer = (
      player:
        | VersusPlayerState
        | {
          username: string;
          state: GameState;
        },
      fallbackName: string,
      modifier: "self" | "opponent",
    ) => {
      const state = player.state;
      const displayName = formatVersusName(player.username, fallbackName);

      return (
        <article className={`versus-game__player versus-game__player--${modifier}`}>
          <div className="versus-game__side-panel versus-game__side-panel--hold">
            <h2>HOLD</h2>
            <div className="solo-game__preview">
              {state.hold ? (
                <MiniFigure figure={state.hold} size={18} />
              ) : (
                <span className="solo-game__empty">EMPTY</span>
              )}
            </div>
            <div className="versus-game__stats">
              <span>LINES</span>
              <strong>{state.lines}</strong>
              <span>SCORE</span>
              <strong>{state.score}</strong>
            </div>
          </div>

          <div className="versus-game__board-wrap">
            <GameBoard gameState={state} cellSize={24} />
            <div className="versus-game__name">
              {displayName}
            </div>
          </div>

          <div className="versus-game__side-panel versus-game__side-panel--next">
            <h2>NEXT</h2>
            <div className="solo-game__next">
              {state.next.slice(0, 5).map((figure, index) => (
                <div className="solo-game__preview" key={`${figure.type}-${index}`}>
                  <MiniFigure figure={figure} size={14} />
                </div>
              ))}
            </div>
          </div>
        </article>
      );
    };

    return (
      <main className="solo-game solo-game--versus">
        <header className="versus-game__topbar">
          <div className="versus-game__live">LIVE</div>
          <div className="versus-game__title">
            VERSUS{" "}
            <strong>
              {formatVersusName(
                selfVersusPlayer?.username ?? currentUser?.username,
                "YOU",
              )}
            </strong>
            {primaryOpponent && (
              <>
                {" "}
                VS <strong>{formatVersusName(primaryOpponent.username, "OPPONENT")}</strong>
              </>
            )}
          </div>
          <button
            className="versus-game__exit"
            onClick={() => {
              socket?.emit("game:stop");
              navigate("/play/multiplayer/custom");
            }}
            type="button"
          >
            EXIT
          </button>
        </header>

        <section className="versus-game__stage">
          {renderVersusPlayer(
            selfVersusPlayer ?? {
              username: currentUser?.username ?? "YOU",
              state: selfState,
            },
            "YOU",
            "self",
          )}

          {opponentState && primaryOpponent ? (
            renderVersusPlayer(primaryOpponent, "OPPONENT", "opponent")
          ) : (
            <article className="versus-game__player versus-game__player--opponent">
              <div className="versus-game__waiting">
                WAITING FOR OPPONENT
              </div>
            </article>
          )}
        </section>

        <div className="solo-game__abort" aria-hidden={escProgress === 0}>
          <div
            className="solo-game__abort__bar"
            style={{ height: `${escProgress * 100}%` }}
          />
          {escProgress > 0 && (
            <div className="solo-game__abort__text">Keep pressing ESC to exit</div>
          )}
        </div>
      </main>
    );
  }

  if (gameConfig?.mode === "solo" && objective?.key !== "none" && soloResult) {
    const resultObjective = gameConfig.objective;
    const resultObjectiveStat = getResultObjectiveStat(
      soloResult.stats,
      resultObjective.key,
    );
    const returnPath = getReturnPath(location.state);

    return (
      <main className="solo-game solo-game--results">
        <header className="solo-game-results__top">
          <h1>RESULTS</h1>
          <div className="solo-game-results__status">
            <span>SOCKET</span>
            <strong>{connectionStatus}</strong>
          </div>
          <button
            className="solo-game-results__back"
            onClick={() => {
              socket?.emit("mode:leave");
              navigate(returnPath);
            }}
            type="button"
          >
            BACK
          </button>
        </header>

        <section className="solo-game-results__card" aria-label={`${modeLabel} results`}>
          <span className="solo-game-results__eyebrow">{resultObjectiveStat.label}</span>
          <strong className="solo-game-results__time">{resultObjectiveStat.value}</strong>

          <div className="solo-game-results__banner">
            {getResultBanner(soloResult.reason, resultObjective, modeLabel)}
          </div>

          <div className="solo-game-results__stats">
            <div>
              <span>LINES</span>
              <strong>{soloResult.stats.lines}</strong>
            </div>
            <div>
              <span>SCORE</span>
              <strong>{soloResult.stats.score}</strong>
            </div>
            <div>
              <span>ROUND</span>
              <strong>{soloResult.stats.round}</strong>
            </div>
          </div>
        </section>

        <nav className="solo-game-results__actions" aria-label="Result actions">
          <button
            className="solo-game-results__again"
            onClick={() => socket?.emit("room:start")}
            type="button"
          >
            AGAIN
          </button>
        </nav>
      </main>
    );
  }

  return (
    <main className="solo-game">
      <section className="solo-game__status" aria-label="Socket status">
        <div>
          <span className="solo-game__label">MODE</span>
          <strong>{modeLabel}</strong>
        </div>
        <div>
          <span className="solo-game__label">SOCKET</span>
          <strong>{connectionStatus}</strong>
        </div>
      </section>

      <section className="solo-game__stage">
        <aside className="solo-game__panel solo-game__panel--hold">
          <h2>HOLD</h2>
          <div className="solo-game__preview">
            {gameState.hold ? (
              <MiniFigure figure={gameState.hold} />
            ) : (
              <span className="solo-game__empty">EMPTY</span>
            )}
          </div>
        </aside>

        {!isZen && (
          <aside className="solo-game__live-stats" aria-label="Run stats">
            <div>
              <span>PPS</span>
              <strong>{piecesPerSecond.toFixed(2)}</strong>
              <small>PIECES/SECOND</small>
            </div>
            <div>
              <span>{primaryStat.label}</span>
              <strong>{primaryStat.value}</strong>
            </div>
            <div>
              <span>TIME</span>
              <strong>{formatRunTime(displayTimeMs)}</strong>
            </div>
          </aside>
        )}

        <GameBoard gameState={gameState} />

        <aside className="solo-game__panel solo-game__panel--next">
          <h2>NEXT</h2>
          <div className="solo-game__next">
            {gameState.next.slice(0, 5).map((figure, index) => (
              <div className="solo-game__preview" key={`${figure.type}-${index}`}>
                <MiniFigure figure={figure} size={16} />
              </div>
            ))}
          </div>
        </aside>
      </section>

      {countdownStep && (
        <SoloCountdownOverlay
          key={`countdown-${countdownStep}`}
          value={countdownStep}
          extension={countdownStep.length <= 2 ? "number" : undefined}
        />
      )}

      {!countdownStep && !soloResult && objectiveWarning && (
        <SoloCountdownOverlay
          key={`warning-${objectiveWarning}`}
          value={objectiveWarning}
          extension="warning"
        />
      )}

      {/* ESC hold abort UI */}
      <div className="solo-game__abort" aria-hidden={escProgress === 0}>
        <div
          className="solo-game__abort__bar"
          style={{ height: `${escProgress * 100}%` }}
        />
        {escProgress > 0 && (
          <div className="solo-game__abort__text">Keep pressing ESC to exit</div>
        )}
      </div>
    </main>
  );
}
