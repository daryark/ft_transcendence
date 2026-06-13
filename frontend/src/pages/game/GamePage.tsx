import { Link } from "react-router-dom";
import MultiplayerGameOver from "./MultiplayerGameOver";
import { getModeLabel } from "./gameUtils";
import { useGameSession } from "./hooks/useGameSession";
import DuelGameView from "./views/DuelGameView";
import RoomGameView from "./views/RoomGameView";
import SoloGameView from "./views/SoloGameView";
import SoloResultsView from "./views/SoloResultsView";
import "./SoloGame.scss";
import { EmptyState, Skeleton } from "../../components/StateView/StateView";
import GameAudioPanel from "../../music/GameAudioPanel";

export default function GamePage() {
  const session = useGameSession();
  const { gameConfig, gameState, result } = session;

  if (!gameState) {
    return (
      <main className="solo-game solo-game--empty">
        {session.sessionError ? (
          <EmptyState
            title="GAME SESSION UNAVAILABLE"
            message={session.sessionError}
            action={
              <>
                <button onClick={session.retryConnection} type="button">
                  RETRY
                </button>
                <Link className="solo-game__link" to={session.returnPath}>
                  Back to game mode
                </Link>
              </>
            }
          />
        ) : (
          <Skeleton lines={6} />
        )}
      </main>
    );
  }

  if (result && gameConfig?.mode === "solo") {
    return <SoloResultsView session={session} />;
  }

  if (result && gameConfig && gameConfig.mode !== "solo") {
    return (
      <MultiplayerGameOver
        connectionStatus={session.connectionStatus}
        modeLabel={getModeLabel(gameConfig)}
        onNext={session.leaveResults}
        players={session.players}
        reason={result.reason}
        stats={result.stats}
        winnerId={result.winnerId}
      />
    );
  }

  const multiplayerPlayerCount = Object.keys(session.players).length;
  const shouldUseDuelLayout =
    gameConfig?.mode === "league" ||
    (gameConfig?.mode !== "solo" &&
      (session.alivePlayers.length === 2 ||
        multiplayerPlayerCount === 2));

  const networkOverlay =
    session.networkStatus !== "online" ? (
      <div className="game-network-overlay" role="status">
        <strong>
          {session.networkStatus === "reconnecting"
            ? "RECONNECTING..."
            : "CONNECTION LOST"}
        </strong>
        <span>Your game will resume from the server when possible.</span>
      </div>
    ) : null;

  if (shouldUseDuelLayout) {
    return (
      <>
        <DuelGameView session={session} />
        {networkOverlay}
        <GameAudioPanel />
      </>
    );
  }

  if (
    gameConfig?.mode === "custom" ||
    gameConfig?.mode === "quickplay"
  ) {
    return (
      <>
        <RoomGameView session={session} />
        {networkOverlay}
        <GameAudioPanel />
      </>
    );
  }

  return (
    <>
      <SoloGameView session={session} />
      {networkOverlay}
      <GameAudioPanel />
    </>
  );
}
