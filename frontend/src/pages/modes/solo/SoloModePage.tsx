import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ModeLayout } from "../../../components/ModeLayout/ModeLayout";
import {
  getSocket,
  subscribeToSocket,
} from "../../../socket/socketClient";
import {
  getStoredGameConfig,
  type SoloBackendPreset,
  type SoloPresetKey,
} from "../../../socket/gameConfigStorage";
import NotFound from "../../notFound/NotFound";
import type { GameStartPayload } from "../../game/types";
import { MODES_CONFIG } from "./config/modes.config";
import { authFetch } from "../../../auth/authFetch";
import { getSessionUser } from "../../../auth/session";

type SoloModeId = "40lines" | "blitz" | "zen";
type ProfileModeKey = "fortyLines" | "blitz" | "zen";

type ProfileModeStats = {
  value?: string;
};

type ProfileResponse = {
  modes?: Partial<Record<ProfileModeKey, ProfileModeStats | null>>;
};

type ProfilePayload = ProfileResponse & {
  profile?: ProfileResponse;
};

type PersonalBestState = {
  modeId: SoloModeId;
  value: string;
};

const SOLO_PRESET_BY_MODE_ID: Record<SoloModeId, {
  dtoKey: SoloPresetKey;
  backendPreset: SoloBackendPreset;
  profileMode: ProfileModeKey;
}> = {
  "40lines": {
    dtoKey: "40lines",
    backendPreset: "40Lines",
    profileMode: "fortyLines",
  },
  blitz: {
    dtoKey: "blitz",
    backendPreset: "blitz",
    profileMode: "blitz",
  },
  zen: {
    dtoKey: "zen",
    backendPreset: "zen",
    profileMode: "zen",
  },
};

function isSoloModeId(value: string | undefined): value is SoloModeId {
  return value === "40lines" || value === "blitz" || value === "zen";
}

function buildSoloPayload(modeId: SoloModeId) {
  const storedConfig = getStoredGameConfig();
  const presetConfig = SOLO_PRESET_BY_MODE_ID[modeId];
  const preset = storedConfig?.solo.presets[presetConfig.dtoKey];

  if (!preset) {
    throw new Error("Game config is not loaded yet");
  }
  return {
    gameConfig: {
      mode: "solo",
      preset: presetConfig.backendPreset,
      objective: preset.objective,
    },
  };
}

async function fetchPersonalBest(
  modeId: SoloModeId,
  signal: AbortSignal,
): Promise<string | null> {
  const user = getSessionUser();

  if (!user || user.isAnonymous) return null;

  const response = await authFetch(
    `/api/users/${encodeURIComponent(user.username)}/profile`,
    { signal },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as ProfilePayload;
  const profile = payload.profile ?? payload;
  const modeKey = SOLO_PRESET_BY_MODE_ID[modeId].profileMode;

  return profile.modes?.[modeKey]?.value ?? null;
}

export default function SoloModePage() {
  const { modeId } = useParams<{ modeId: string }>();
  const config = isSoloModeId(modeId) ? MODES_CONFIG[modeId] : undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const autoStartAttemptedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [personalBestState, setPersonalBestState] =
    useState<PersonalBestState | null>(null);
  const [socket, setSocket] = useState(() => getSocket());
  const navigationState = location.state as
    | { autoStart?: boolean; from?: string }
    | null;

  useEffect(() => {
    return subscribeToSocket(() => {
      setSocket(getSocket());
    });
  }, []);

  useEffect(() => {
    if (!isSoloModeId(modeId)) return undefined;
    if (modeId === "zen") {
      setPersonalBestState(null);
      return undefined;
    }

    const user = getSessionUser();
    if (!user || user.isAnonymous) {
      setPersonalBestState(null);
      return undefined;
    }

    const controller = new AbortController();

    void fetchPersonalBest(modeId, controller.signal)
      .then((best) => {
        if (!controller.signal.aborted) {
          setPersonalBestState({ modeId, value: best ?? "NO RECORD" });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPersonalBestState(null);
        }
      });

    return () => controller.abort();
  }, [modeId]);

  const personalBest =
    isSoloModeId(modeId) && modeId !== "zen" && personalBestState?.modeId === modeId
      ? personalBestState.value
      : undefined;

  const handleStart = useCallback(() => {
    if (!isSoloModeId(modeId)) return;

    setStartError("");

    if (!socket) {
      setStartError("Socket is not connected yet.");
      return;
    }

    setIsLoading(true);

    const returnPath = navigationState?.from ?? `/play/solo/${modeId}`;

    const handleGameStart = (payload: GameStartPayload) => {
      socket.off("server:error", handleModeError);
      setIsLoading(false);
      // include return path so the game can navigate back if aborted
      navigate(`/game/${payload.roomId}`, { state: { ...payload, from: returnPath } });
    };

    const handleModeError = (error: { reason?: string }) => {
      socket.off("game:start", handleGameStart);
      setIsLoading(false);
      setStartError(error.reason ?? "Failed to start solo mode.");
    };

    socket.off("game:start", handleGameStart);
    socket.off("server:error", handleModeError);
    socket.once("game:start", handleGameStart);
    socket.once("server:error", handleModeError);

    try {
      const payload = buildSoloPayload(modeId);

      // persist return path in session storage so game page can navigate back if aborted
      try {
        window.sessionStorage.setItem(
          "tetra-active-game",
          JSON.stringify({ from: returnPath }),
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
      socket.off("server:error", handleModeError);
      setIsLoading(false);
      setStartError(
        error instanceof Error ? error.message : "Game config is not loaded yet.",
      );
      return;
    }

  }, [modeId, navigate, navigationState?.from, socket]);

  useEffect(() => {
    if (!navigationState?.autoStart || autoStartAttemptedRef.current) return;
    if (!socket) return;

    autoStartAttemptedRef.current = true;
    const timeoutId = window.setTimeout(handleStart, 0);
    return () => window.clearTimeout(timeoutId);
  }, [handleStart, navigationState?.autoStart, socket]);

  if (!config || !isSoloModeId(modeId)) return <NotFound />;

  return (
    <ModeLayout
      title={config.title}
      description={config.description}
      accentColor={config.accentColor}
      personalBest={personalBest}
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
