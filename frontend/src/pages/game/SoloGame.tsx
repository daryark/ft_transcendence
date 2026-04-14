import { useState } from "react";
import GameBoard from "../../components/GameBoard/GameBoard";
import HoldPanel from "../../components/MiniPiece/MiniPiece";
import type { GameState } from "../game/state";
import type { Figure } from "../game/figures";
import { initGame } from "../game/state";
import "./SoloGame.scss";

export default function SoloGame() {
  const [gameState, setGameState] = useState(() => initGame(20, 10));

  return (
    <>
      <div className="board">
        <div className="hold">
          <h3>HOLD</h3>
          {gameState.hold ? (
            <HoldPanel piece={gameState.hold} />
          ) : (
            <div>empty</div>
          )}
        </div>
        <div>
          <GameBoard
            rows={20}
            cols={10}
            cellSize={30}
            onRestart={() => setGameState(initGame(20, 10))}
          />
        </div>

        <div className="next">
          <h3>NEXT</h3>

          {/* {gameState.next.slice(0, 5).map((piece, i) => (
          <MiniPiece key={i} piece={piece} />
        ))} */}
        </div>
      </div>
    </>
  );
}
