import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import GameBoard from "../../components/GameBoard/GameBoard";
import MiniFigure from "../../components/MiniFigure/MiniFigure";
import { getSession } from "../../auth/session";
import {
  connectSocket,
  getSocket,
} from "../../socket/SocketConfigSync";
import type { GameStartPayload, GameState, PlayerMove } from "./types";
import "./SoloGame.scss";

const ACTIVE_GAME_KEY = "tetra-active-game";
const INPUT_COOLDOWN_MS = 115;
const TARGET_LINES = 40;

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
  const lastInputAt = useRef(0);

  const linesLeft = useMemo(() => {
    if (!gameState) return TARGET_LINES;
    return Math.max(0, TARGET_LINES - gameState.lines);
  }, [gameState]);

  useEffect(() => {
    const session = getSession();
    const socket = getSocket() ?? connectSocket(session?.token);

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
  }, [gameId]);

  useEffect(() => {
    const socket = getSocket();

    if (!socket || !gameState || gameState.gameOver) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      const move = keyToMove(event);

      if (!move) return;

      event.preventDefault();

      const now = window.performance.now();
      if (now - lastInputAt.current < INPUT_COOLDOWN_MS) return;

      lastInputAt.current = now;
      socket.emit("player:move", { type: move });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameState]);

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
