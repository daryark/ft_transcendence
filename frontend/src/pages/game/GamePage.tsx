import { useEffect } from "react";
import { Link } from "react-router-dom";
import MultiplayerGameOver from "./MultiplayerGameOver";
import QuickGameOver from "./QuickGameOver";
import { getModeLabel } from "./gameUtils";
import { useGameSession } from "./hooks/useGameSession";
import RoomGameView from "./views/RoomGameView";
import SoloGameView from "./views/SoloGameView";
import SoloResultsView from "./views/SoloResultsView";
import "./SoloGame.scss";
import { EmptyState, Skeleton } from "../../components/StateView/StateView";
import GameAudioPanel from "../../music/GameAudioPanel";
import RoundResultOverlay from "./components/RoundResultOverlay";
import GameCountdownOverlay from "./components/GameCountdownOverlay";

function CountdownLayer({ value }: { value: string | null }) {
  if (!value) return null;

  return (
    <GameCountdownOverlay
      key={`countdown-${value}`}
      value={value}
      variant={value.length <= 2 ? "number" : undefined}
    />
  );
}

export default function GamePage() {
  const session = useGameSession();
  const { gameConfig, gameState, result } = session;

  useEffect(() => {
    document.body.classList.add("game-screen-active");

    return () => {
      document.body.classList.remove("game-screen-active");
    };
  }, []);

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
    if (gameConfig.mode === "quickplay") {
      return (
        <QuickGameOver
          chatMessages={session.quickplayLobby.chatMessages}
          climbers={session.quickplayLobby.players}
          onAgain={session.restartQuickplay}
          onChatMessage={session.sendQuickplayChatMessage}
          onExit={session.leaveResults}
          onSendToChat={session.sendQuickplayResultToChat}
          onSpectate={session.spectateQuickplay}
          quickplay={result.quickplay}
          stats={result.stats}
        />
      );
    }

    return (
      <MultiplayerGameOver
        mode={gameConfig.mode}
        modeLabel={getModeLabel(gameConfig)}
        onNext={session.leaveResults}
        players={session.players}
        reason={result.reason}
        stats={result.stats}
        winnerId={result.winnerId}
      />
    );
  }

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

  if (
    gameConfig?.mode === "custom" ||
    gameConfig?.mode === "quickplay"
  ) {
    return (
      <>
        <RoomGameView session={session} />
        <RoundResultOverlay result={session.roundResult} />
        <CountdownLayer value={session.countdownStep} />
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
