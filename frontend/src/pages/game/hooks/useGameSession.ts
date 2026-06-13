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
  PlayerMove,
  PlayerMovePhase,
  VersusPlayerState,
} from "../types";

const HORIZONTAL_REPEAT_DELAY_MS = 95;
const HORIZONTAL_REPEAT_MS = 42;
const ESC_HOLD_MS = 2000;
const COUNTDOWN_STEP_MS = 900;
const INPUT_COOLDOWNS: Partial<Record<PlayerMove, number>> = {
  down: 40,
  rotate: 75,
  rotateCCW: 75,
  rotate180: 75,
  hold: 140,
  drop: 180,
};

type GameUpdatePayload =
  | GameState
  | (GameStartPayload & { players: Record<string, VersusPlayerState> });

export type GameResult = {
  reason: GameEndPayload["reason"];
  stats: GameStats;
  winnerId?: GameEndPayload["winnerId"];
};

function keyToMove(event: KeyboardEvent): PlayerMove | null {
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  if (event.key === "ArrowDown") return "down";
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") {
    return "rotate";
  }
  if (event.key.toLowerCase() === "z") return "rotateCCW";
  if (event.key === " ") return "drop";
  if (event.key.toLowerCase() === "c" || event.shiftKey) return "hold";

  return null;
}

function getInitialPayload(locationState: unknown, gameId?: string) {
  const locationPayload = toActiveGamePayload(locationState);

  if (locationPayload.roomId === gameId && locationPayload.state) {
    return locationPayload;
  }

  return readStoredActiveGame(gameId) ?? {};
}

export function useGameSession() {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [countdownStep, setCountdownStep] = useState<CountdownStep>(() => {
    if (initialPayload.roomId !== gameId) return null;
    return getCountdownSequence(initialPayload.config ?? null)[0] ?? null;
  });
  const [socket, setSocket] = useState(() => getSocket());
  const [connectionStatus, setConnectionStatus] = useState(() =>
    getSocket() ? "CONNECTING" : "OFFLINE",
  );
  const [escProgress, setEscProgress] = useState(0);
  const gameStateRef = useRef(gameState);
  const gameConfigRef = useRef(gameConfig);
  const countdownRef = useRef(countdownStep);
  const resultRef = useRef(result);
  const lastInputAt = useRef<Partial<Record<PlayerMove, number>>>({});
  const horizontalRepeat = useRef<{
    key: "ArrowLeft" | "ArrowRight";
    timeoutId: number;
    intervalId: number | null;
  } | null>(null);
  const escIntervalRef = useRef<number | null>(null);
  const escStartRef = useRef<number | null>(null);
  const returnPath = getReturnPath(location.state, gameId);

  useEffect(() => {
    gameStateRef.current = gameState;
    gameConfigRef.current = gameConfig;
    countdownRef.current = countdownStep;
    resultRef.current = result;
  }, [countdownStep, gameConfig, gameState, result]);

  useEffect(() => {
    const isMultiplayer = !!gameConfig && gameConfig.mode !== "solo";

    document.body.classList.toggle("game-session-active", isMultiplayer);

    return () => {
      document.body.classList.remove("game-session-active");
    };
  }, [gameConfig]);

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
    const handleDisconnect = () => setConnectionStatus("OFFLINE");
    const handleUpdate = (payload: GameUpdatePayload) => {
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
      setCountdownStep(
        getCountdownSequence(payload.config ?? null)[0] ?? null,
      );
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

      if (!state || !stats) return;

      setGameState(state);
      setResult({
        reason: payload.reason,
        stats,
        winnerId: payload.winnerId,
      });
    };

    if (socket.connected) handleConnect();
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("game:update", handleUpdate);
    socket.on("game:start", handleStart);
    socket.on("game:end", handleEnd);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("game:update", handleUpdate);
      socket.off("game:start", handleStart);
      socket.off("game:end", handleEnd);
    };
  }, [gameId, playerIdentityId, socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const clearEsc = () => {
      if (escIntervalRef.current !== null) {
        window.clearInterval(escIntervalRef.current);
        escIntervalRef.current = null;
      }
      escStartRef.current = null;
      setEscProgress(0);
    };
    const startEsc = () => {
      if (escStartRef.current !== null) return;

      escStartRef.current = window.performance.now();
      escIntervalRef.current = window.setInterval(() => {
        const startedAt = escStartRef.current ?? window.performance.now();
        const progress = Math.min(
          1,
          (window.performance.now() - startedAt) / ESC_HOLD_MS,
        );
        setEscProgress(progress);

        if (progress >= 1) {
          socket.emit("game:stop");
          clearStoredActiveGame(gameId);
          clearEsc();
          navigate(returnPath);
        }
      }, 100);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      startEsc();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearEsc();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearEsc();
    };
  }, [gameId, navigate, returnPath, socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const emitMove = (
      move: PlayerMove,
      phase: PlayerMovePhase = "press",
      repeat = false,
    ) => {
      if (phase === "release") {
        socket.emit("player:move", { type: move, phase });
        return;
      }
      if (countdownRef.current || resultRef.current) {
        return;
      }

      const cooldown = INPUT_COOLDOWNS[move] ?? 0;
      const now = window.performance.now();
      if (now - (lastInputAt.current[move] ?? 0) < cooldown) return;

      lastInputAt.current[move] = now;
      socket.emit("player:move", { type: move, phase, repeat });
    };
    const stopHorizontalRepeat = (release = false) => {
      const active = horizontalRepeat.current;
      if (!active) return;

      const move = active.key === "ArrowLeft" ? "left" : "right";
      window.clearTimeout(active.timeoutId);
      if (active.intervalId !== null) {
        window.clearInterval(active.intervalId);
      }
      horizontalRepeat.current = null;
      if (release) emitMove(move, "release");
    };
    const startHorizontalRepeat = (
      key: "ArrowLeft" | "ArrowRight",
      move: PlayerMove,
    ) => {
      if (horizontalRepeat.current?.key === key) return;

      stopHorizontalRepeat(true);
      emitMove(move);
      const timeoutId = window.setTimeout(() => {
        const intervalId = window.setInterval(
          () => emitMove(move, "press", true),
          HORIZONTAL_REPEAT_MS,
        );

        if (horizontalRepeat.current?.key === key) {
          horizontalRepeat.current.intervalId = intervalId;
        } else {
          window.clearInterval(intervalId);
        }
      }, HORIZONTAL_REPEAT_DELAY_MS);
      horizontalRepeat.current = { key, timeoutId, intervalId: null };
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        countdownRef.current ||
        resultRef.current ||
        gameStateRef.current?.gameOver
      ) {
        return;
      }

      const move = keyToMove(event);
      if (!move) return;

      event.preventDefault();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        startHorizontalRepeat(event.key, move);
        return;
      }
      if (
        event.repeat &&
        (move === "rotate" ||
          move === "rotateCCW" ||
          move === "rotate180" ||
          move === "drop")
      ) {
        return;
      }
      emitMove(move, "press", event.repeat);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (horizontalRepeat.current?.key === event.key) {
        stopHorizontalRepeat(true);
      } else if (event.key === "ArrowDown") {
        emitMove("down", "release");
      }
    };
    const handleBlur = () => {
      stopHorizontalRepeat(true);
      emitMove("down", "release");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      stopHorizontalRepeat(true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [socket]);

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

  const exitGame = () => {
    socket?.emit("game:stop");
    clearStoredActiveGame(gameId);
    navigate(returnPath);
  };

  return {
    gameId,
    gameState,
    gameConfig,
    players,
    result,
    countdownStep,
    connectionStatus,
    escProgress,
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
    leaveResults: () => {
      socket?.emit("mode:leave");
      navigate(returnPath);
    },
    restartSolo: () => socket?.emit("room:start"),
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
