import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import GameBoard from "../../components/GameBoard/GameBoard";
import MiniFigure from "../../components/MiniFigure/MiniFigure";
import {
  getSocket,
  subscribeToSocket,
} from "../../socket/socketClient";
import type { GameConfig } from "../../../shared/types/config.types";
import type {
  GameEndPayload,
  GameStartPayload,
  GameState,
  PlayerMove,
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

type ActiveGamePayload = GameStartPayload & {
  from?: string;
  runStartedAt?: number;
};

type CountdownStep =
  | "CLEAR 40 LINES!"
  | "TWO-MINUTE BLITZ"
  | (typeof COUNTDOWN_NUMBERS)[number]
  | null;

type SoloResult = {
  reason: GameEndPayload["reason"];
  endedAt: number;
  runStartedAt: number;
  state: GameState;
};

const toActiveGamePayload = (value: unknown): Partial<ActiveGamePayload> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Partial<ActiveGamePayload>;
};

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
  const millis = safeMilliseconds % 1000;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis
    .toString()
    .padStart(3, "0")}`;
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

export default function SoloGame() {
  const { gameId } = useParams();
  const location = useLocation();
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
  const [now, setNow] = useState(() => Date.now());
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
  const isFortyLines = gameConfig?.mode === "solo" && gameConfig.preset === "40Lines";
  const isZen = gameConfig?.mode === "solo" && gameConfig.preset === "zen";
  const targetLines =
    objective?.winCondition === "lines" ? objective.linesToClear ?? 40 : 40;
  const elapsedMs = runStartedAt ? Math.max(0, now - runStartedAt) : 0;
  const displayTimeMs =
    objective?.winCondition === "time"
      ? Math.max(0, (objective.timeLimit ?? 0) * 1000 - elapsedMs)
      : elapsedMs;
  const elapsedSeconds = elapsedMs / 1000;
  const linesPerMinute =
    gameState && elapsedSeconds > 0 ? (gameState.lines / elapsedSeconds) * 60 : 0;
  const lineProgress = gameState && objective?.winCondition === "lines"
    ? `${gameState.lines}/${targetLines}`
    : `${gameState?.lines ?? 0}`;

  const modeLabel = getSoloModeLabel(gameConfig);

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
        setNow(startedAt);
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
    if (objective?.winCondition !== "time" || !gameState || gameState.gameOver) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [gameState, objective?.winCondition]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleConnect = () => setConnectionStatus("LIVE");
    const handleDisconnect = () => setConnectionStatus("OFFLINE");
    const handleUpdate = (state: GameState) => {
      setConnectionStatus("LIVE");
      if (countdownStepRef.current) return;

      setGameState(state);
      setNow(Date.now());
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
            config: saved?.config ?? gameConfigRef.current,
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
      setGameState(payload.state);
      setGameConfig(payload.config ?? null);
      setSoloResult(null);
      const countdownSequence = getCountdownSequence(payload.config ?? null);
      const needsCountdown = countdownSequence.length > 0;
      const startedAt = needsCountdown ? null : Date.now();

      setRunStartedAt(startedAt);
      setCountdownStep(countdownSequence[0] ?? null);
      setNow(startedAt ?? Date.now());

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
            state: payload.state,
            config: payload.config,
            runStartedAt: startedAt,
            from,
          }),
        );
      } catch {
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state: payload.state }),
        );
      }
    };
    const handleEnd = (payload: GameEndPayload) => {
      if (payload.roomId !== gameId) return;
      setConnectionStatus("ENDED");
      setGameState(payload.state);
      setSoloResult({
        reason: payload.reason,
        endedAt: Date.now(),
        runStartedAt: runStartedAtRef.current ?? payload.state.startedAt,
        state: payload.state,
      });
      setCountdownStep(null);
      setNow(Date.now());
      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = toActiveGamePayload(
          savedRaw ? JSON.parse(savedRaw) : null,
        );
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({
            roomId: gameId,
            state: payload.state,
            config: saved?.config ?? gameConfigRef.current,
            runStartedAt: saved?.runStartedAt ?? runStartedAtRef.current,
            from: saved?.from,
          }),
        );
      } catch {
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state: payload.state }),
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
  }, [gameId, socket]);

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

    const emitMove = (move: PlayerMove) => {
      if (inputLockedRef.current) return;

      const cooldown = INPUT_COOLDOWNS[move] ?? 0;
      const now = window.performance.now();
      const lastAt = lastInputAt.current[move] ?? 0;

      if (now - lastAt < cooldown) return;

      lastInputAt.current[move] = now;
      socket.emit("player:move", { type: move });
    };

    const stopHorizontalRepeat = () => {
      if (!horizontalRepeat.current) return;

      window.clearTimeout(horizontalRepeat.current.timeoutId);

      if (horizontalRepeat.current.intervalId !== null) {
        window.clearInterval(horizontalRepeat.current.intervalId);
      }

      horizontalRepeat.current = null;
    };

    const startHorizontalRepeat = (
      key: "ArrowLeft" | "ArrowRight",
      move: PlayerMove,
    ) => {
      if (horizontalRepeat.current?.key === key) return;

      stopHorizontalRepeat();
      emitMove(move);

      const timeoutId = window.setTimeout(() => {
        const intervalId = window.setInterval(() => {
          emitMove(move);
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

      emitMove(move);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        horizontalRepeat.current &&
        event.key === horizontalRepeat.current.key
      ) {
        stopHorizontalRepeat();
      }
    };

    const handleBlur = () => {
      stopHorizontalRepeat();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      stopHorizontalRepeat();
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

  if (isFortyLines && soloResult) {
    const runTime = formatRunTime(soloResult.endedAt - soloResult.runStartedAt);
    const returnPath = getReturnPath(location.state);

    return (
      <main className="solo-game solo-game--results">
        <header className="solo-game-results__top">
          <h1>RESULTS</h1>
          <div className="solo-game-results__status">
            <span>SOCKET</span>
            <strong>{connectionStatus}</strong>
          </div>
          <Link className="solo-game-results__back" to={returnPath}>
            BACK
          </Link>
        </header>

        <section className="solo-game-results__card" aria-label="40 Lines results">
          <span className="solo-game-results__eyebrow">FINAL TIME</span>
          <strong className="solo-game-results__time">{runTime}</strong>

          <div className="solo-game-results__banner">
            {soloResult.reason === "objective_complete" ? "40 LINES CLEAR" : "RUN ENDED"}
          </div>

          <div className="solo-game-results__stats">
            <div>
              <span>LINES</span>
              <strong>{soloResult.state.lines}</strong>
            </div>
            <div>
              <span>SCORE</span>
              <strong>{soloResult.state.score}</strong>
            </div>
            <div>
              <span>ROUND</span>
              <strong>{soloResult.state.round}</strong>
            </div>
          </div>
        </section>

        <nav className="solo-game-results__actions" aria-label="Result actions">
          <Link className="solo-game-results__again" to="/play/solo/40lines">
            AGAIN
          </Link>
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
              <span>SPEED</span>
              <strong>{linesPerMinute.toFixed(2)}</strong>
              <small>LINES/MIN</small>
            </div>
            <div>
              <span>LINES</span>
              <strong>{lineProgress}</strong>
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
        <div
          className={`solo-game__countdown ${
            countdownStep.length <= 2 ? "solo-game__countdown--number" : ""
          }`}
          aria-live="polite"
        >
          {countdownStep}
        </div>
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
