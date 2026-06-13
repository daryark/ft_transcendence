import { formatPlayerName, getModeLabel } from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import PlayerBoardCard from "../components/PlayerBoardCard";

type DuelGameViewProps = {
  session: GameSession;
};

export default function DuelGameView({ session }: DuelGameViewProps) {
  const {
    alivePlayers,
    gameConfig,
    gameState,
    isSpectating,
    selfPlayer,
  } = session;
  if (!gameState || !gameConfig || gameConfig.mode === "solo") return null;

  const visiblePlayers = isSpectating
    ? alivePlayers.slice(0, 2)
    : [
        ...(selfPlayer ? [selfPlayer] : []),
        ...alivePlayers.filter(
          (player) => String(player.id) !== String(selfPlayer?.id),
        ),
      ].slice(0, 2);
  const firstPlayer = visiblePlayers[0];
  const secondPlayer = visiblePlayers[1];

  return (
    <main className="solo-game solo-game--versus">
      <header className="versus-game__topbar">
        <div className="versus-game__live">LIVE</div>
        <div className="versus-game__title">
          {isSpectating ? "SPECTATING" : getModeLabel(gameConfig)}{" "}
          {firstPlayer && (
            <>
              <strong>
                {formatPlayerName(firstPlayer.username, "PLAYER 1")}
              </strong>
              {secondPlayer && (
                <>
                  {" "}
                  VS{" "}
                  <strong>
                    {formatPlayerName(secondPlayer.username, "PLAYER 2")}
                  </strong>
                </>
              )}
            </>
          )}
        </div>
        <button
          className="versus-game__exit"
          onClick={session.exitGame}
          type="button"
        >
          EXIT
        </button>
      </header>

      <section className="versus-game__stage">
        {firstPlayer ? (
          <PlayerBoardCard
            controls={gameConfig.controls}
            fallbackName={isSpectating ? "PLAYER 1" : "YOU"}
            modifier="self"
            state={firstPlayer.state}
            username={firstPlayer.username}
          />
        ) : (
          <article className="versus-game__player versus-game__player--self">
            <div className="versus-game__waiting">
              WAITING FOR PLAYER
            </div>
          </article>
        )}

        {secondPlayer ? (
          <PlayerBoardCard
            controls={gameConfig.controls}
            fallbackName="PLAYER 2"
            modifier="opponent"
            state={secondPlayer.state}
            username={secondPlayer.username}
          />
        ) : (
          <article className="versus-game__player versus-game__player--opponent">
            <div className="versus-game__waiting">
              WAITING FOR OPPONENT
            </div>
          </article>
        )}
      </section>

      <GameAbortOverlay progress={session.escProgress} />
    </main>
  );
}
