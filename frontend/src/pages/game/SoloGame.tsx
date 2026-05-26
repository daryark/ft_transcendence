import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import GameBoard from "../../components/GameBoard/GameBoard";
import MiniFigure from "../../components/MiniFigure/MiniFigure";
import {
  getSocket,
  subscribeToSocket,
} from "../../socket/SocketConfigSync";
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
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [socket, setSocket] = useState(() => getSocket());
  const lastInputAt = useRef<Partial<Record<PlayerMove, number>>>({});
  const horizontalRepeat = useRef<{
    key: "ArrowLeft" | "ArrowRight";
    timeoutId: number;
    intervalId: number | null;
  } | null>(null);

  const linesLeft = useMemo(() => {
    if (!gameState) return TARGET_LINES;
    return Math.max(0, TARGET_LINES - gameState.lines);
  }, [gameState]);

  useEffect(() => {
    return subscribeToSocket(() => {
      setSocket(getSocket());
    });
  }, []);

  useEffect(() => {
    if (!socket) {
      setConnectionStatus("OFFLINE");
      return undefined;
    }

    const handleConnect = () => setConnectionStatus("LIVE");
    const handleDisconnect = () => setConnectionStatus("OFFLINE");
    const handleUpdate = (state: GameState) => {
      setConnectionStatus("LIVE");
      setGameState(state);
      window.sessionStorage.setItem(
        ACTIVE_GAME_KEY,
        JSON.stringify({ roomId: gameId, state }),
      );
    };
    const handleStart = (payload: GameStartPayload) => {
      if (payload.roomId !== gameId) return;
      setConnectionStatus("LIVE");
      setGameState(payload.state);
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

  useEffect(() => {
    if (!socket || !gameState || gameState.gameOver) return undefined;

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
      const move = keyToMove(event);

      if (!move) return;

      event.preventDefault();

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        startHorizontalRepeat(event.key, move);
        return;
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      stopHorizontalRepeat();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, socket]);

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
    </main>
  );
}
