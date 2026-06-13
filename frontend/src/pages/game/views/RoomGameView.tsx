import { useState } from "react";
import GameBoard from "../../../components/GameBoard/GameBoard";
import { formatPlayerName, getModeLabel } from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import GamePreviewPanel from "../components/GamePreviewPanel";

type RoomGameViewProps = {
  session: GameSession;
};

export default function RoomGameView({ session }: RoomGameViewProps) {
  const {
    alivePlayers,
    eliminatedPlayers,
    gameConfig,
    gameState,
    isSpectating,
    selfPlayer,
  } = session;
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    null,
  );
  if (!gameState || !gameConfig || gameConfig.mode === "solo") return null;

  const selectedTarget = alivePlayers.find(
    (player) => String(player.id) === selectedTargetId,
  );
  const targetPlayer = isSpectating
    ? selectedTarget ?? alivePlayers[0]
    : selfPlayer;
  const targetState = targetPlayer?.state ?? gameState;
  const previewPlayers = alivePlayers.filter(
    (player) => String(player.id) !== String(targetPlayer?.id),
  );
  const opponentCellSize =
    previewPlayers.length <= 2 ? 13 : previewPlayers.length <= 3 ? 10 : 8;

  return (
    <main className="solo-game room-game">
      <header className="versus-game__topbar">
        <div className="versus-game__live">LIVE</div>
        <div className="versus-game__title">
          {isSpectating ? "SPECTATING" : getModeLabel(gameConfig)}{" "}
          <strong>
            {formatPlayerName(targetPlayer?.username, "PLAYER")}
          </strong>
          <span className="room-game__population">
            {alivePlayers.length} ALIVE
            {eliminatedPlayers.length > 0 &&
              ` / ${eliminatedPlayers.length} OUT`}
          </span>
        </div>
        <button
          className="versus-game__exit"
          onClick={session.exitGame}
          type="button"
        >
          EXIT
        </button>
      </header>

      <section className="room-game__stage">
        <div className="room-game__self">
          <div className="room-game__left-rail">
            {gameConfig.controls.hold && (
              <GamePreviewPanel
                className="solo-game__panel room-game__hold"
                figureSize={18}
                state={targetState}
                type="hold"
              />
            )}
            <div className="room-game__stats" aria-label="Player stats">
              <div>
                <span>PIECES</span>
                <strong>{targetState.piecesPlaced}</strong>
                <small>
                  {targetState.update.piecesPerSecond.toFixed(2)}/S
                </small>
              </div>
              <div>
                <span>LINES</span>
                <strong>{targetState.lines}</strong>
              </div>
              <div>
                <span>SCORE</span>
                <strong>{targetState.score}</strong>
              </div>
            </div>
          </div>

          <div className="room-game__main-board">
            <GameBoard
              cellSize={32}
              gameState={targetState}
              showGhost={gameConfig.controls.showShadowPiece}
            />
            <div className="versus-game__name">
              {formatPlayerName(
                targetPlayer?.username ??
                  selfPlayer?.username ??
                  session.currentUser?.username,
                isSpectating ? "SPECTATING" : "YOU",
              )}
            </div>
          </div>

          <div className="room-game__right-rail">
            <GamePreviewPanel
              className="solo-game__panel room-game__next"
              figureSize={16}
              nextCount={gameConfig.controls.nextPieces}
              state={targetState}
              type="next"
            />
          </div>
        </div>

        <aside
          className={`room-game__opponents room-game__opponents--${Math.min(
            previewPlayers.length,
            6,
          )}`}
          aria-label="Opponents"
        >
          {previewPlayers.length > 0 ? (
            previewPlayers.map((player) => (
              <button
                className="room-game__opponent"
                disabled={!isSpectating}
                key={player.id}
                onClick={() => setSelectedTargetId(String(player.id))}
                type="button"
              >
                <GameBoard
                  cellSize={opponentCellSize}
                  gameState={player.state}
                  showGhost={false}
                />
                <div className="room-game__opponent-name">
                  {formatPlayerName(player.username, "PLAYER")}
                </div>
                <div className="room-game__opponent-stats">
                  <span>{player.state.lines} L</span>
                  <span>{player.state.score} PTS</span>
                </div>
                {isSpectating && (
                  <span className="room-game__watch">WATCH</span>
                )}
              </button>
            ))
          ) : (
            <div className="room-game__waiting">
              {alivePlayers.length === 0
                ? "WAITING FOR ROUND RESULT"
                : "LAST PLAYER STANDING"}
            </div>
          )}
        </aside>
      </section>

      <GameAbortOverlay progress={session.escProgress} />
    </main>
  );
}
