import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ModeLayout } from "../../../components/ModeLayout/ModeLayout";
import { getSession } from "../../../auth/session";
import {
  connectSocket,
  getSocket,
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

const fallbackSoloPreset: Required<ConfigPreset> = {
  roomConfig: {
    maxPlayers: 1,
    public: false,
    anonymousAllowed: true,
    unrankedAllowed: true,
  },
  gameConfig: {
    mode: "solo",
    general: {
      bagType: "7-bag",
      boardWidth: 10,
      boardHeight: 20,
    },
    controls: {
      hold: true,
      nextPieces: 5,
      showShadowPiece: true,
    },
    survival: {
      mode: "none",
      garbageMessiness: 0,
      stickyLayer: true,
      minimumLayerHight: 0,
      timerInterval: 300,
    },
    gravity: {
      lockDelay: 30,
      gravity: 0.02,
      useLeveling: false,
      gravityIncrease: 0.0007,
      gravitMarginTime: 10000,
    },
    objective: {
      winCondition: "lines",
      scoreToWin: 0,
      linesToClear: 40,
      timeLimit: 0,
      key: "time",
      allowRetry: false,
      stock: 2,
    },
  },
};

function buildSoloPayload(modeId: string) {
  const storedConfig = getStoredGameConfig() as
    | { solo?: ConfigPreset }
    | null;
  const preset = storedConfig?.solo ?? fallbackSoloPreset;

  if (modeId !== "40lines") {
    return preset;
  }

  return {
    ...preset,
    roomConfig: {
      ...fallbackSoloPreset.roomConfig,
      ...preset.roomConfig,
    },
    gameConfig: {
      ...fallbackSoloPreset.gameConfig,
      ...preset.gameConfig,
      mode: "solo",
      objective: {
        ...fallbackSoloPreset.gameConfig.objective,
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

  if (!config || !modeId) return <NotFound />;

  const handleStart = () => {
    const session = getSession();
    const socket = getSocket() ?? connectSocket(session?.token);

    setIsLoading(true);

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
      payload: buildSoloPayload(modeId),
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
