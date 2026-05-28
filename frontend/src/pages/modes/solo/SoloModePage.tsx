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

type ConfigPreset = {
  roomConfig?: Record<string, unknown>;
  gameConfig?: {
    mode?: string;
    general?: Record<string, unknown>;
    controls?: Record<string, unknown>;
    survival?: Record<string, unknown>;
    gravity?: Record<string, unknown>;
    objective?: Record<string, unknown>;
  };
};

function buildSoloPayload(modeId: string) {
  const storedConfig = getStoredGameConfig() as
    | { solo?: ConfigPreset }
    | null;

  if (!storedConfig?.solo) {
    throw new Error("Game config is not loaded yet");
  }

  const preset = storedConfig.solo;

  if (modeId !== "40lines") {
    return preset;
  }

  return {
    ...preset,
    gameConfig: {
      ...preset.gameConfig,
      mode: "solo",
      objective: {
        ...preset.gameConfig?.objective,
        winCondition: "lines",
        linesToClear: 40,
        key: "time",
      },
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

    let payload: ConfigPreset;
    try {
      payload = buildSoloPayload(modeId);
    } catch (error) {
      setIsLoading(false);
      setStartError(
        error instanceof Error ? error.message : "Game config is not loaded yet.",
      );
      return;
    }

    const handleGameStart = (payload: GameStartPayload) => {
      socket.off("mode_error", handleModeError);
      window.sessionStorage.setItem(
        "tetra-active-game",
        JSON.stringify(payload),
      );
      setIsLoading(false);
      navigate(`/game/${payload.roomId}`, { state: payload });
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

    socket.emit("mode:join", {
      mode: "solo",
      payload,
    });
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
