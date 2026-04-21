import { useState } from "react";
import GameBoard from "../../components/GameBoard/GameBoard";
import HoldPanel from "../../components/MiniPiece/MiniPiece";
import MiniPiece from "../../components/MiniPiece/MiniPiece";
import type { GameState } from "../game/state";
import type { Figure } from "../game/figures";
import { initGame } from "../game/state";
import "./SoloGame.scss";

import { holdPiece } from "./logic";

export default function SoloGame() {
  const [gameState, setGameState] = useState(() => initGame(20, 10));

  const handleHold = () => {
    setGameState((prev) => holdPiece(prev));
    console.log(gameState.hold);
  };

  return (
    <>
      <div className="board">
        {/* HOLD */}
        <div className="hold">
          <h3>HOLD</h3>

          <div className="hold__box">
            {gameState.hold ? (
              <HoldPanel piece={gameState.hold} size={18} />
            ) : (
              <div className="empty">—</div>
            )}
          </div>
        </div>

        {/* GAME */}
        <GameBoard
          rows={20}
          cols={10}
          cellSize={30}
          gameState={gameState} // передаем state
          setGameState={setGameState} // передаем управление
          onHold={handleHold} // передаем холд
          onRestart={() => setGameState(initGame(20, 10))}
        />

        <div className="next">
          <h3>NEXT</h3>

          <div className="next__list">
            {gameState.next.slice(0, 5).map((piece, i) => (
              <div key={i} className="next__item">
                <MiniPiece piece={piece} size={14} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
