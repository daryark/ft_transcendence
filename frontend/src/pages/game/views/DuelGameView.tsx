import { useEffect, useState, type CSSProperties } from "react";
import { formatPlayerName, getModeLabel } from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import GameFocusOverlay from "../components/GameFocusOverlay";
import PlayerBoardCard from "../components/PlayerBoardCard";

type DuelGameViewProps = {
  session: GameSession;
};

const TABLET_BREAKPOINT_PX = 860;
const PLAYER_SCALE_FLOOR = 0.74;
const VERSUS_BASE_WIDTH_PX = 76 * 16;
const VERSUS_BASE_HEIGHT_PX = 48 * 16;

function getVersusLayout() {
  if (window.innerWidth <= TABLET_BREAKPOINT_PX) {
    return {
      opponentScale: PLAYER_SCALE_FLOOR,
      selfScale: PLAYER_SCALE_FLOOR,
    };
  }

  const widthScale = (window.innerWidth - 32) / VERSUS_BASE_WIDTH_PX;
  const heightScale = (window.innerHeight - 64) / VERSUS_BASE_HEIGHT_PX;
  const scale = Math.min(
    1,
    Math.max(PLAYER_SCALE_FLOOR, Math.min(widthScale, heightScale)),
  );

  return {
    opponentScale: scale,
    selfScale: scale,
  };
}

export default function DuelGameView({ session }: DuelGameViewProps) {
  const {
    alivePlayers,
    gameConfig,
    gameState,
    isSpectating,
    selfPlayer,
  } = session;
  const [layout, setLayout] = useState(getVersusLayout);

  useEffect(() => {
    const updateScale = () => setLayout(getVersusLayout());

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

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
  const stageScale = Math.min(layout.selfScale, layout.opponentScale);
  const style = {
    "--versus-opponent-scale": String(layout.opponentScale),
    "--versus-player-scale": String(stageScale),
    "--versus-self-scale": String(layout.selfScale),
  } as CSSProperties;

  return (
    <main className="solo-game solo-game--versus" style={style}>
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
        <div className="versus-game__player-slot versus-game__player-slot--self">
          {firstPlayer ? (
            <PlayerBoardCard
              controls={gameConfig.controls}
              fallbackName={isSpectating ? "PLAYER 1" : "YOU"}
              modifier="self"
              scale={layout.selfScale}
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
        </div>

        <div className="versus-game__player-slot versus-game__player-slot--opponent">
          {secondPlayer ? (
            <PlayerBoardCard
              controls={gameConfig.controls}
              fallbackName="PLAYER 2"
              modifier="opponent"
              scale={layout.opponentScale}
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
        </div>
      </section>

      <GameAbortOverlay progress={session.escProgress} />
      <GameFocusOverlay active={!session.focused && !session.result} />
    </main>
  );
}
