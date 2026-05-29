import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ModeLayout } from "../../../components/ModeLayout/ModeLayout";
import {
  getSocket,
  subscribeToSocket,
} from "../../../socket/socketClient";
import { getStoredGameConfig } from "../../../socket/gameConfigStorage";
import NotFound from "../../notFound/NotFound";
import type { GameStartPayload } from "../../game/types";
import { MODES_CONFIG } from "./config/modes.config";

function buildSoloPayload(modeId: string) {
  const storedConfig = getStoredGameConfig();
  const presetKey = modeId === "40lines" ? "40lines" : modeId;
  const preset = storedConfig?.solo.presets[presetKey];

  if (!preset) {
    throw new Error("Game config is not loaded yet");
  }
  return {
    gameConfig: {
      mode: "solo",
      preset: modeId === "40lines" ? "40Lines" : modeId,
      objective: preset.objective,
    },
  };
}

export default function SoloModePage() {
  const { modeId } = useParams<{ modeId: string }>();
  const config = modeId ? MODES_CONFIG[modeId] : undefined;
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(() => {
    return subscribeToSocket(() => {
      setSocket(getSocket());
    });
  }, []);

  if (!config || !modeId) return <NotFound />;

  const handleStart = () => {
    setStartError("");

    if (!socket) {
      setStartError("Socket is not connected yet.");
      return;
    }

    setIsLoading(true);

    const handleGameStart = (payload: GameStartPayload) => {
      socket.off("mode_error", handleModeError);
      setIsLoading(false);
      // include return path so the game can navigate back if aborted
      navigate(`/game/${payload.roomId}`, { state: { ...payload, from: `/play/solo/${modeId}` } });
    };

    const handleModeError = (error: { reason?: string }) => {
      socket.off("game:start", handleGameStart);
      setIsLoading(false);
      setStartError(error.reason ?? "Failed to start solo mode.");
    };

    socket.off("game:start", handleGameStart);
    socket.off("mode_error", handleModeError);
    socket.once("game:start", handleGameStart);
    socket.once("mode_error", handleModeError);

    try {
      const payload = buildSoloPayload(modeId);

      // persist return path in session storage so game page can navigate back if aborted
      try {
        window.sessionStorage.setItem(
          "tetra-active-game",
          JSON.stringify({ from: `/play/solo/${modeId}` }),
        );
      } catch {
        // ignore
      }

      socket.emit("mode:join", {
        mode: "solo",
        payload,
      });
    } catch (error) {
      socket.off("game:start", handleGameStart);
      socket.off("mode_error", handleModeError);
      setIsLoading(false);
      setStartError(
        error instanceof Error ? error.message : "Game config is not loaded yet.",
      );
      return;
    }

  };

  return (
    <ModeLayout
      title={config.title}
      description={config.description}
      accentColor={config.accentColor}
      personalBest={config.personalBest}
      showMusic={config.showMusic}
      onStart={handleStart}
      isLoading={isLoading}
      headerExtra={
        startError ? (
          <div className="mode-layout__error" role="alert">
            {startError}
          </div>
        ) : null
      }
    />
  );
}
