import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";

import GameBoard from "../../components/GameBoard/GameBoard";
import MiniFigure from "../../components/MiniFigure/MiniFigure";
import type { GameState } from "../game/state";

import "./SoloGame.scss";

export default function SoloGame() {
  const { gameId } = useParams();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // 🔥 подключение к серверу
  useEffect(() => {
    const s = io("http://localhost:3001");

    setSocket(s);

    s.emit("join", { gameId });

    s.on("state", (state: GameState) => {
      setGameState(state);
    });

    return () => {
      s.disconnect();
    };
  }, [gameId]);

  // 🔥 отправка input (клавиши)
  useEffect(() => {
    if (!socket) return;

    const handleKey = (e: KeyboardEvent) => {
      let action = null;

      if (e.key === "ArrowLeft") action = { type: "LEFT" };
      if (e.key === "ArrowRight") action = { type: "RIGHT" };
      if (e.key === "ArrowDown") action = { type: "DOWN" };
      if (e.key === "ArrowUp") action = { type: "ROTATE" };
      if (e.key === " ") action = { type: "DROP" };
      if (e.key.toLowerCase() === "c") action = { type: "HOLD" };

      if (action) {
        socket.emit("action", { gameId, action });
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [socket, gameId]);

  if (!gameState) return <div>Loading...</div>;

  return (
    <div className="board">
      {/* HOLD */}
      <div className="hold">
        <h3>HOLD</h3>

        {gameState.hold ? (
          <MiniFigure figure={gameState.hold} />
        ) : (
          <div className="empty">—</div>
        )}
      </div>

      {/* GAME */}
      <GameBoard
        rows={gameState.rows}
        cols={gameState.cols}
        cellSize={30}
        gameState={gameState} // 🔥 теперь приходит с сервера
      />

      {/* NEXT */}
      <div className="next">
        <h3>NEXT</h3>

        <div className="next__list">
          {gameState.next.slice(0, 5).map((figure, i) => (
            <div key={i} className="next__item">
              <MiniFigure figure={figure} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}