import { useState } from "react";
import GameBoard from "../../components/GameBoard/GameBoard";
import MiniPiece from "../../components/MiniPiece/MiniPiece";
import type { GameState } from "../game/state";
import type { Figure } from "../game/figures";
import {initGame} from "../game/state"

export default function SoloGame() {
  const [gameState] = useState(() => initGame(20, 10));
  return (
    <>
      <div
        style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}
      >
        <GameBoard rows={20} cols={10} cellSize={30} />
      </div>
      <div className="hold">
        <h3>HOLD</h3>
        {gameState.hold ? <MiniPiece piece={gameState.hold} /> : <div>empty</div>}
      </div>
      <div className="next">
        <h3>NEXT</h3>

        {gameState.next.slice(0, 5).map((piece, i) => (
          <MiniPiece key={i} piece={piece} />
        ))}
      </div>
    </>
  );
}
