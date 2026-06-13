import { Link } from "react-router-dom";
import MultiplayerGameOver from "./MultiplayerGameOver";
import { getModeLabel } from "./gameUtils";
import { useGameSession } from "./hooks/useGameSession";
import DuelGameView from "./views/DuelGameView";
import RoomGameView from "./views/RoomGameView";
import SoloGameView from "./views/SoloGameView";
import SoloResultsView from "./views/SoloResultsView";
import "./SoloGame.scss";

export default function GamePage() {
  const session = useGameSession();
  const { gameConfig, gameState, result } = session;

  if (!gameState) {
    return (
      <main className="solo-game solo-game--empty">
        <p>Waiting for game state...</p>
        <Link className="solo-game__link" to={session.returnPath}>
          Back to game mode
        </Link>
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

  if (shouldUseDuelLayout) {
    return <DuelGameView session={session} />;
  }

  if (
    gameConfig?.mode === "custom" ||
    gameConfig?.mode === "quickplay"
  ) {
    return <RoomGameView session={session} />;
  }

  return <SoloGameView session={session} />;
}
