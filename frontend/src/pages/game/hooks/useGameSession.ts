import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { GameConfig } from "../../../../shared/types/config.types";
import { getSessionUser } from "../../../auth/session";
import {
  getSocket,
  getSocketIdentityId,
  subscribeToSocket,
} from "../../../socket/socketClient";
import {
  clearStoredActiveGame,
  getReturnPath,
  readStoredActiveGame,
  saveActiveGame,
  toActiveGamePayload,
  type ActiveGamePayload,
} from "../gameStorage";
import {
  getCountdownSequence,
  isMultiplayerPayload,
  type CountdownStep,
} from "../gameUtils";
import type {
  GameEndPayload,
  GameStartPayload,
  GameState,
  GameStats,
  RoundEndPayload,
  VersusPlayerState,
} from "../types";
import { useConfirm } from "../../../components/Confirm/ConfirmProvider";
import { useToast } from "../../../components/Toast/ToastProvider";
import {
  emitKoPopup,
  emitXpPopup,
} from "../../../components/XpPopup/xpPopupEvents";
import { useNetworkStatus } from "../../../network/NetworkProvider";
import { useGameControls } from "./useGameControls";

const COUNTDOWN_STEP_MS = 900;

type GameUpdatePayload =
  | GameState
  | (GameStartPayload & { players: Record<string, VersusPlayerState> });

export type GameResult = {
  reason: GameEndPayload["reason"];
  stats: GameStats;
  winnerId?: GameEndPayload["winnerId"];
  round?: number;
  roundWins?: Record<string, number>;
  roundsToWin?: number;
  winByRounds?: number;
  goldenPoint?: number;
  quickplay?: {
    meters: number;
    floor: number;
    floorName?: string;
    previousBestMeters: number | null;
    isPersonalBest: boolean;
  };
};

type QuickplayLobbyPlayer = {
  id: string | number;
  username?: string;
  quickplayMeters?: number;
};

type QuickplayChatMessage = {
  id: string;
  author: string;
  actor?: string;
  floor?: number;
  floorName?: string;
  isPersonalBest?: boolean;
  meters?: number;
  system?: boolean;
  text: string;
  variant?: string;
};

type QuickplayLobbySnapshot = {
  players: QuickplayLobbyPlayer[];
  chatMessages: QuickplayChatMessage[];
};

type QuickplayKoSnapshot = {
  id: number;
  playerId: string | number;
  username?: string;
  meters?: number;
};

function normalizeQuickplayChatMessage(
  message: {
    actor?: string;
    floor?: number;
    floorName?: string;
    id?: string;
    isPersonalBest?: boolean;
    message?: string;
    meters?: number;
    sender?: string;
    system?: boolean;
    text?: string;
    variant?: string;
  },
  index: number,
): QuickplayChatMessage {
  return {
    id: message.id ?? `${Date.now()}-${index}`,
    author: message.sender ?? "PLAYER",
    actor: message.actor,
    floor: message.floor,
    floorName: message.floorName,
    isPersonalBest: message.isPersonalBest,
    meters: message.meters,
    system: message.system,
    text: message.text ?? message.message ?? "",
    variant: message.variant,
  };
}

function getInitialPayload(locationState: unknown, gameId?: string) {
  const locationPayload = toActiveGamePayload(locationState);

  if (locationPayload.roomId === gameId && locationPayload.state) {
    return locationPayload;
  }

  return readStoredActiveGame(gameId) ?? {};
}

function getActiveCountdownStep(
  config: GameConfig | null | undefined,
  state: GameState | null | undefined,
) {
  if (!state || state.startedAt <= Date.now()) return null;

  return getCountdownSequence(config ?? null)[0] ?? null;
}

function getMultiplayerExitPath(config: GameConfig | null) {
  if (config?.mode === "custom") return "/play/multiplayer/custom";
  if (config?.mode === "quickplay") return "/play/multiplayer/quick";

  return null;
}

export function useGameSession() {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const networkStatus = useNetworkStatus();
  const [initialPayload] = useState(() =>
    getInitialPayload(location.state, gameId),
  );
  const currentUser = getSessionUser();
  const currentUserId = currentUser ? String(currentUser.id) : null;
  const [socketIdentityId, setSocketIdentityId] = useState(() =>
    getSocketIdentityId(),
  );
  const playerIdentityId = socketIdentityId ?? currentUserId;
  const [gameState, setGameState] = useState<GameState | null>(
    () => initialPayload.state ?? null,
  );
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(
    () => initialPayload.config ?? null,
  );
  const [players, setPlayers] = useState<
    Record<string, VersusPlayerState>
  >(() => initialPayload.players ?? {});
  const [result, setResult] = useState<GameResult | null>(null);
  const [quickplayLobby, setQuickplayLobby] = useState<QuickplayLobbySnapshot>({
    players: [],
    chatMessages: [],
  });
  const [quickplayKos, setQuickplayKos] = useState<QuickplayKoSnapshot[]>([]);
  const [roundResult, setRoundResult] = useState<RoundEndPayload | null>(null);
  const [countdownStep, setCountdownStep] = useState<CountdownStep>(() => {
    if (initialPayload.roomId !== gameId) return null;
    return getActiveCountdownStep(
      initialPayload.config ?? null,
      initialPayload.state ?? null,
    );
  });
  const [socket, setSocket] = useState(() => getSocket());
  const [connectionStatus, setConnectionStatus] = useState(() =>
    getSocket() ? "CONNECTING" : "OFFLINE",
  );
  const [sessionError, setSessionError] = useState("");
  const gameStateRef = useRef(gameState);
  const gameConfigRef = useRef(gameConfig);
  const countdownRef = useRef(countdownStep);
  const returnPath = getReturnPath(location.state, gameId);
  const multiplayerExitPath = getMultiplayerExitPath(gameConfig);
  const controls = useGameControls({
    socket,
    gameId,
    gameState,
    countdownActive: Boolean(countdownStep),
    resultActive: Boolean(result),
    returnPath,
    exitPath: multiplayerExitPath ?? undefined,
    navigate,
  });

  useEffect(() => {
    gameStateRef.current = gameState;
    gameConfigRef.current = gameConfig;
    countdownRef.current = countdownStep;
  }, [countdownStep, gameConfig, gameState]);

  useEffect(() => {
    const leaveQuickplayOnHistoryNavigation = () => {
      if (gameConfigRef.current?.mode !== "quickplay") return;

      getSocket()?.emit("mode:leave");
      clearStoredActiveGame(gameId);
    };

    window.addEventListener("popstate", leaveQuickplayOnHistoryNavigation);

    return () => {
      window.removeEventListener("popstate", leaveQuickplayOnHistoryNavigation);
    };
  }, [gameId]);

  useEffect(() => {
    const isMultiplayer =
      !!gameConfig &&
      gameConfig.mode !== "solo" &&
      !(gameConfig.mode === "quickplay" && result);

    document.body.classList.toggle("game-session-active", isMultiplayer);

    return () => {
      document.body.classList.remove("game-session-active");
    };
  }, [gameConfig, result]);

  useEffect(() => {
    const payload = toActiveGamePayload(location.state);

    if (payload.roomId === gameId && payload.state) {
      saveActiveGame(payload);
    }
  }, [gameId, location.state]);

  useEffect(
    () =>
      subscribeToSocket(() => {
        setSocket(getSocket());
        setSocketIdentityId(getSocketIdentityId());
      }),
    [],
  );

  useEffect(() => {
    if (!countdownStep) return undefined;

    const sequence = getCountdownSequence(gameConfig);
    const currentIndex = sequence.indexOf(countdownStep);
    if (currentIndex < 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      const nextStep = sequence[currentIndex + 1] ?? null;
      setCountdownStep(nextStep);

      if (!nextStep) {
        const saved = readStoredActiveGame(gameId);
        saveActiveGame({ ...saved, runStartedAt: Date.now() });
      }
    }, COUNTDOWN_STEP_MS);

    return () => window.clearTimeout(timeoutId);
  }, [countdownStep, gameConfig, gameId]);

  useEffect(() => {
    if (!socket) return undefined;

    const selectState = (
      payload: GameStartPayload | GameEndPayload,
    ): GameState | null =>
      payload.players?.[playerIdentityId ?? ""]?.state ??
      (payload.players ? Object.values(payload.players)[0]?.state : payload.state) ??
      null;

    const handleConnect = () => setConnectionStatus("LIVE");
    const handleReconnect = () => {
      handleConnect();
      socket.emit("game:resume");
    };
    const handleDisconnect = () => setConnectionStatus("RECONNECTING");
    const handleResume = (payload: ActiveGamePayload) => {
      if (payload.roomId !== gameId) return;

      const state = selectState(payload);
      if (!state) {
        setSessionError("The server could not restore this game.");
        return;
      }

      setSessionError("");
      setConnectionStatus("LIVE");
      setGameState(state);
      setGameConfig(payload.config ?? gameConfigRef.current);
      setPlayers(payload.players ?? {});
      saveActiveGame({
        roomId: payload.roomId,
        config: payload.config ?? gameConfigRef.current ?? undefined,
        from: readStoredActiveGame(gameId)?.from,
        runStartedAt: state.startedAt,
      });
    };
    const handleServerError = (payload: { reason?: string }) => {
      if (
        payload.reason === "NO_ACTIVE_GAME" ||
        payload.reason === "ROOM_NOT_FOUND"
      ) {
        clearStoredActiveGame(gameId);
        setSessionError("This game is no longer available on the server.");
        navigate(returnPath, { replace: true });
      }
    };
    const handleUpdate = (payload: GameUpdatePayload) => {
      if (
        isMultiplayerPayload(payload) &&
        payload.roomId &&
        payload.roomId !== gameId
      ) {
        return;
      }

      setConnectionStatus("LIVE");
      if (countdownRef.current) return;

      const state = isMultiplayerPayload(payload)
        ? payload.players[playerIdentityId ?? ""]?.state ??
          Object.values(payload.players)[0]?.state
        : payload;

      if (isMultiplayerPayload(payload)) {
        setPlayers(payload.players);
        setGameConfig(payload.config ?? gameConfigRef.current);
      }
      if (!state) return;

      setGameState(state);
      const saved = readStoredActiveGame(gameId);
      saveActiveGame({
        roomId: gameId,
        state,
        config: isMultiplayerPayload(payload)
          ? payload.config
          : saved?.config ?? gameConfigRef.current ?? undefined,
        players: isMultiplayerPayload(payload)
          ? payload.players
          : saved?.players,
        runStartedAt: saved?.runStartedAt,
        from: saved?.from,
      });
    };
    const handleStart = (payload: ActiveGamePayload) => {
      if (payload.roomId !== gameId) return;

      const state = selectState(payload);
      if (!state) return;

      const saved = readStoredActiveGame(gameId);
      setConnectionStatus("LIVE");
      setGameState(state);
      setGameConfig(payload.config ?? null);
      setPlayers(payload.players ?? {});
      setResult(null);
      setCountdownStep(getActiveCountdownStep(payload.config ?? null, state));
      saveActiveGame({
        ...payload,
        state,
        runStartedAt: state.startedAt,
        from: payload.from ?? saved?.from,
      });
    };
    const handleEnd = (payload: GameEndPayload) => {
      if (payload.roomId !== gameId) return;

      const state = selectState(payload) ?? gameStateRef.current;
      const stats = payload.result?.stats ?? state?.update;

      clearStoredActiveGame(gameId);
      setConnectionStatus("ENDED");
      setPlayers(payload.players ?? {});
      setCountdownStep(null);

      const finalStats: GameStats =
        stats ?? {
          score: 0,
          lines: 0,
          piecesPlaced: 0,
          elapsedMs: 0,
          remainingMs: null,
          piecesPerSecond: 0,
          round: 1,
          serverNow: Date.now(),
          objective: null,
        };

      if (state) setGameState(state);
      const progression = payload.result?.progression ?? [];
      const selfProgression = progression.find(
        (entry) => String(entry.playerId) === String(playerIdentityId),
      );

      if (selfProgression?.xpDelta) {
        emitXpPopup(selfProgression.xpDelta);
      }

      const nextResult: GameResult = {
        reason: payload.reason,
        stats: finalStats,
        winnerId: payload.winnerId,
        round: payload.round,
        roundWins: payload.roundWins,
        roundsToWin: payload.roundsToWin,
        winByRounds: payload.winByRounds,
        goldenPoint: payload.goldenPoint,
        quickplay:
          gameConfigRef.current?.mode === "quickplay"
            ? {
                meters:
                  (payload.players?.[playerIdentityId ?? ""]?.quickplayMeters ??
                    (state?.quickplay?.meters ??
                      state?.update?.quickplay?.meters ??
                      0)),
                floor:
                  state?.quickplay?.floor ??
                  state?.update?.quickplay?.floor ??
                  1,
                floorName: undefined,
                previousBestMeters: null,
                isPersonalBest: false,
              }
            : undefined,
      };

      setResult(nextResult);
      if (gameConfigRef.current?.mode === "quickplay") {
        navigate("/play/multiplayer/quick", {
          replace: true,
          state: { quickplayResult: nextResult },
        });
      }
    };
    const handleQuickplayResult = (payload: {
      roomId?: string;
      playerId?: string | number;
      reason?: GameEndPayload["reason"];
      quickplay?: {
        meters?: number;
        floor?: number;
        floorName?: string;
        previousBestMeters?: number | null;
        isPersonalBest?: boolean;
      };
      stats?: GameStats | null;
      result?: {
        progression?: Array<{
          playerId: string;
          xpDelta: number;
          level: number;
          xp: number;
        }>;
      };
    }) => {
      if (payload.roomId !== gameId) return;
      if (String(payload.playerId) !== String(playerIdentityId)) return;

      clearStoredActiveGame(gameId);
      setConnectionStatus("ENDED");
      setCountdownStep(null);

      const finalStats: GameStats =
        payload.stats ??
        gameStateRef.current?.update ?? {
          score: 0,
          lines: 0,
          piecesPlaced: 0,
          elapsedMs: 0,
          remainingMs: null,
          piecesPerSecond: 0,
          round: 1,
          serverNow: Date.now(),
          objective: null,
        };
      const selfProgression = payload.result?.progression?.find(
        (entry) => String(entry.playerId) === String(playerIdentityId),
      );

      if (selfProgression?.xpDelta) {
        emitXpPopup(selfProgression.xpDelta);
      }

      const nextResult: GameResult = {
        reason: payload.reason ?? "game_over",
        stats: finalStats,
        quickplay: {
          meters: payload.quickplay?.meters ?? 0,
          floor: payload.quickplay?.floor ?? 1,
          floorName: payload.quickplay?.floorName,
          previousBestMeters: payload.quickplay?.previousBestMeters ?? null,
          isPersonalBest: Boolean(payload.quickplay?.isPersonalBest),
        },
      };

      setResult(nextResult);
      navigate("/play/multiplayer/quick", {
        replace: true,
        state: { quickplayResult: nextResult },
      });
    };
    const handleQuickplayKo = (payload: {
      roomId?: string;
      playerId?: string | number;
      username?: string;
      meters?: number;
    }) => {
      if (payload.roomId !== gameId || payload.playerId === undefined) return;

      if (String(payload.playerId) === String(playerIdentityId)) {
        emitKoPopup();
      }

      const id = Date.now();
      setQuickplayKos((current) => [
        ...current,
        {
          id,
          playerId: payload.playerId!,
          username: payload.username,
          meters: payload.meters,
        },
      ]);
      window.setTimeout(() => {
        setQuickplayKos((current) => current.filter((entry) => entry.id !== id));
      }, 1800);
    };
    const handleQuickplayWarning = (payload: {
      roomId?: string;
      playerId?: string | number;
      message?: string;
      seconds?: number;
    }) => {
      if (payload.roomId !== gameId) return;
      if (String(payload.playerId) !== String(playerIdentityId)) return;

      showToast(
        payload.message ??
          `Only one player remains. Quick Play ends in ${
            payload.seconds ?? 60
          } seconds if nobody joins.`,
        "info",
      );
    };
    const handleQuickplayLobby = (payload: {
      players?: QuickplayLobbyPlayer[];
      chatMessages?: Array<Parameters<typeof normalizeQuickplayChatMessage>[0]>;
    }) => {
      setQuickplayLobby({
        players: payload.players ?? [],
        chatMessages: (payload.chatMessages ?? []).map((message, index) =>
          normalizeQuickplayChatMessage(message, index),
        ),
      });
    };
    const handleChatMessage = (
      payload: Parameters<typeof normalizeQuickplayChatMessage>[0],
    ) => {
      if (gameConfigRef.current?.mode !== "quickplay") return;

      setQuickplayLobby((current) => ({
        ...current,
        chatMessages: [
          ...current.chatMessages,
          normalizeQuickplayChatMessage(payload, current.chatMessages.length),
        ],
      }));
    };
    const handleRoundEnd = (payload: RoundEndPayload) => {
      if (payload.roomId !== gameId) return;

      setRoundResult(payload);
      window.setTimeout(() => {
        setRoundResult((current) => (current === payload ? null : current));
      }, 2400);
    };

    if (socket.connected) {
      handleReconnect();
    }
    socket.on("connect", handleReconnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("game:update", handleUpdate);
    socket.on("game:start", handleStart);
    socket.on("game:resume", handleResume);
    socket.on("game:end", handleEnd);
    socket.on("quickplay:result", handleQuickplayResult);
    socket.on("quickplay:ko", handleQuickplayKo);
    socket.on("quickplay:warning", handleQuickplayWarning);
    socket.on("quickplay:lobby", handleQuickplayLobby);
    socket.on("chat:message", handleChatMessage);
    socket.on("round:end", handleRoundEnd);
    socket.on("server:error", handleServerError);

    return () => {
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("game:update", handleUpdate);
      socket.off("game:start", handleStart);
      socket.off("game:resume", handleResume);
      socket.off("game:end", handleEnd);
      socket.off("quickplay:result", handleQuickplayResult);
      socket.off("quickplay:ko", handleQuickplayKo);
      socket.off("quickplay:warning", handleQuickplayWarning);
      socket.off("quickplay:lobby", handleQuickplayLobby);
      socket.off("chat:message", handleChatMessage);
      socket.off("round:end", handleRoundEnd);
      socket.off("server:error", handleServerError);
    };
  }, [gameId, navigate, playerIdentityId, returnPath, showToast, socket]);

  const playerEntries = useMemo(() => Object.values(players), [players]);
  const selfPlayer =
    (playerIdentityId ? players[playerIdentityId] : undefined) ??
    playerEntries.find(
      (player) => player.username === currentUser?.username,
    );
  const alivePlayers = playerEntries.filter(
    (player) => !player.gameOver && !player.state.gameOver,
  );
  const eliminatedPlayers = playerEntries.filter(
    (player) => player.gameOver || player.state.gameOver,
  );
  const hasMultiplayerRoster = playerEntries.length > 0;
  const isParticipant = !hasMultiplayerRoster || Boolean(selfPlayer);
  const isPlayerEliminated = Boolean(
    selfPlayer && (selfPlayer.gameOver || selfPlayer.state.gameOver),
  );
  const isSpectating =
    hasMultiplayerRoster && (!isParticipant || isPlayerEliminated);
  const opponents = playerEntries.filter(
    (player) => String(player.id) !== String(selfPlayer?.id),
  );

  const exitGame = async () => {
    const approved = await confirm({
      title: "Leave active game?",
      message: "Leaving now will stop your run or remove you from the match.",
      confirmLabel: "LEAVE GAME",
    });
    if (!approved) return;

    socket?.emit("game:stop");
    clearStoredActiveGame(gameId);
    navigate(multiplayerExitPath ?? returnPath, { replace: true });
  };

  const leaveActiveGameView = () => {
    clearStoredActiveGame(gameId);
    navigate(returnPath, { replace: true });
  };

  return {
    gameId,
    gameState,
    gameConfig,
    players,
    result,
    roundResult,
    quickplayLobby,
    quickplayKos,
    countdownStep,
    connectionStatus,
    networkStatus,
    sessionError,
    escProgress: controls.escProgress,
    focused: controls.focused,
    currentUser,
    selfPlayer,
    opponents,
    alivePlayers,
    eliminatedPlayers,
    isParticipant,
    isPlayerEliminated,
    isSpectating,
    returnPath,
    exitGame,
    leaveActiveGameView,
    leaveResults: () => {
      if (gameConfigRef.current?.mode !== "custom") {
        socket?.emit("mode:leave");
      }
      navigate(returnPath);
    },
    restartQuickplay: () => {
      const config = gameConfigRef.current;
      if (!socket || config?.mode !== "quickplay") return;

      const handleStart = (payload: GameStartPayload) => {
        if (!payload.roomId) return;

        socket.off("game:start", handleStart);
        navigate(`/game/${payload.roomId}`, {
          replace: true,
          state: {
            ...payload,
            from: "/play/multiplayer/quick",
          },
        });
      };

      socket.once("game:start", handleStart);
      setResult(null);
      socket.emit("mode:join", {
        mode: "quickplay",
        payload: {
          gameConfig: {
            mode: "quickplay",
            modifiers: config.modifiers ?? [],
          },
        },
      });
    },
    sendQuickplayResultToChat: () => {
      const currentResult = result;
      if (!socket || gameConfigRef.current?.mode !== "quickplay" || !currentResult?.quickplay) {
        return;
      }

      const floor = currentResult.quickplay.floorName
        ? ` on ${currentResult.quickplay.floorName}`
        : "";
      const best = currentResult.quickplay.isPersonalBest
        ? " New personal best!"
        : "";

      socket.emit("chat:message", {
        message: `Quick Play result: ${currentResult.quickplay.meters.toFixed(1)}m${floor}.${best}`,
        quickplayResult: {
          floor: currentResult.quickplay.floor,
          floorName: currentResult.quickplay.floorName,
          isPersonalBest: currentResult.quickplay.isPersonalBest,
          meters: currentResult.quickplay.meters,
        },
      });
      showToast("Result sent to Quick Play chat.", "success");
    },
    sendQuickplayChatMessage: (message: string) => {
      const text = message.trim();
      if (!socket || !text || gameConfigRef.current?.mode !== "quickplay") return;

      socket.emit("chat:message", { message: text });
    },
    spectateQuickplay: () => {
      if (!socket || gameConfigRef.current?.mode !== "quickplay") return;

      const handleStart = (payload: GameStartPayload) => {
        if (!payload.roomId) return;

        socket.off("game:start", handleStart);
        navigate(`/game/${payload.roomId}`, {
          replace: true,
          state: {
            ...payload,
            from: "/play/multiplayer/quick",
          },
        });
      };

      socket.once("game:start", handleStart);
      socket.emit("quickplay:spectate");
    },
    restartSolo: () => socket?.emit("room:start"),
    retryConnection: () => {
      setSessionError("");
      socket?.connect();
      socket?.emit("game:resume");
      showToast("Trying to restore the game session.", "info");
    },
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
