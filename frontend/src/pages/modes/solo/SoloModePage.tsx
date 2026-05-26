import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ModeLayout } from "../../../components/ModeLayout/ModeLayout";
import {
  getSocket,
  subscribeToSocket,
} from "../../../socket/SocketConfigSync";
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
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(() => {
    return subscribeToSocket(() => {
      setSocket(getSocket());
    });
  }, []);

  if (!config || !modeId) return <NotFound />;

  const handleStart = () => {
    if (!socket) {
      console.error("Socket is not connected yet");
      return;
    }

    setIsLoading(true);

    let payload: ConfigPreset;
    try {
      payload = buildSoloPayload(modeId);
    } catch (error) {
      setIsLoading(false);
      console.error(error);
      return;
    }

    socket.once("game:start", (payload: GameStartPayload) => {
      window.sessionStorage.setItem(
        "tetra-active-game",
        JSON.stringify(payload),
      );
      setIsLoading(false);
      navigate(`/game/${payload.roomId}`, { state: payload });
    });

    socket.once("mode_error", (error: { reason?: string }) => {
      setIsLoading(false);
      console.error("Failed to start solo mode:", error.reason);
    });

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
    />
  );
}
