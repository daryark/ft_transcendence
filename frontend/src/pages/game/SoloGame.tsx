import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import GameBoard from "../../components/GameBoard/GameBoard";
import MiniFigure from "../../components/MiniFigure/MiniFigure";
import {
  getSocket,
  subscribeToSocket,
} from "../../socket/socketClient";
import type { GameStartPayload, GameState, PlayerMove } from "./types";
import "./SoloGame.scss";

const ACTIVE_GAME_KEY = "tetra-active-game";
const TARGET_LINES = 40;
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

function getInitialState(locationState: unknown) {
  const payload = locationState as GameStartPayload | null;

  if (payload?.state) {
    return payload.state;
  }

  try {
    const saved = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
    const parsed = saved ? (JSON.parse(saved) as GameStartPayload) : null;

    return parsed?.state ?? null;
  } catch {
    return null;
  }
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
  if (event.key.toLowerCase() === "c") return "hold";

  return null;
}

export default function SoloGame() {
  const { gameId } = useParams();
  const location = useLocation();
  const [gameState, setGameState] = useState<GameState | null>(() =>
    getInitialState(location.state),
  );
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

  const [escProgress, setEscProgress] = useState(0);
  const escIntervalRef = useRef<number | null>(null);
  const escStartRef = useRef<number | null>(null);

  const linesLeft = useMemo(() => {
    if (!gameState) return TARGET_LINES;
    return Math.max(0, TARGET_LINES - gameState.lines);
  }, [gameState]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    return subscribeToSocket(() => {
      setSocket(getSocket());
    });
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleConnect = () => setConnectionStatus("LIVE");
    const handleDisconnect = () => setConnectionStatus("OFFLINE");
    const handleUpdate = (state: GameState) => {
      setConnectionStatus("LIVE");
      setGameState(state);
      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = savedRaw ? JSON.parse(savedRaw) : {};
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state, from: saved?.from }),
        );
      } catch {
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state }),
        );
      }
    };
    const handleStart = (payload: GameStartPayload & { from?: string }) => {
      if (payload.roomId !== gameId) return;
      setConnectionStatus("LIVE");
      setGameState(payload.state);

      try {
        const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
        const saved = savedRaw ? JSON.parse(savedRaw) : {};
        const from = (payload as any).from ?? saved?.from;
        window.sessionStorage.setItem(
          ACTIVE_GAME_KEY,
          JSON.stringify({ roomId: gameId, state: payload.state, from }),
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
    socket.on("game:end", handleUpdate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("game:update", handleUpdate);
      socket.off("game:start", handleStart);
      socket.off("game:end", handleUpdate);
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
          // determine return path
          let returnTo =
            (location.state as any)?.from ??
            (() => {
              try {
                const savedRaw = window.sessionStorage.getItem(ACTIVE_GAME_KEY);
                const saved = savedRaw ? JSON.parse(savedRaw) : {};
                return saved?.from;
              } catch {
                return undefined;
              }
            })();

          if (!returnTo) returnTo = "/play/solo/40lines";

          clearEsc();
          navigate(returnTo);
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
      if (gameStateRef.current?.gameOver) return;

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
        <Link className="solo-game__link" to="/play/solo/40lines">
          Back to 40 Lines
        </Link>
      </main>
    );
  }

  return (
    <main className="solo-game">
      <section className="solo-game__hud" aria-label="Game status">
        <div>
          <span className="solo-game__label">MODE</span>
          <strong>40 LINES</strong>
        </div>
        <div>
          <span className="solo-game__label">LINES LEFT</span>
          <strong>{linesLeft}</strong>
        </div>
        <div>
          <span className="solo-game__label">SCORE</span>
          <strong>{gameState.score}</strong>
        </div>
        <div>
          <span className="solo-game__label">SOCKET</span>
          <strong>{connectionStatus}</strong>
        </div>
      </section>

      <section className="solo-game__stage">
        <aside className="solo-game__panel">
          <h2>HOLD</h2>
          <div className="solo-game__preview">
            {gameState.hold ? (
              <MiniFigure figure={gameState.hold} />
            ) : (
              <span className="solo-game__empty">EMPTY</span>
            )}
          </div>
        </aside>

        <GameBoard gameState={gameState} />

        <aside className="solo-game__panel">
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
