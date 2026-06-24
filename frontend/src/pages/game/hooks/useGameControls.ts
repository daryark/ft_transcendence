import { useEffect, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { clearStoredActiveGame } from "../gameStorage";
import type {
  GameState,
  PlayerMove,
  PlayerMovePhase,
} from "../types";

const HORIZONTAL_REPEAT_DELAY_MS = 95;
const HORIZONTAL_REPEAT_MS = 42;
const ESC_HOLD_MS = 2000;
const INPUT_COOLDOWNS: Partial<Record<PlayerMove, number>> = {
  down: 40,
  rotate: 75,
  rotateCCW: 75,
  rotate180: 75,
  hold: 140,
  drop: 180,
};

type GameControlsOptions = {
  socket: Socket | null;
  gameId?: string;
  gameState: GameState | null;
  countdownActive: boolean;
  resultActive: boolean;
  returnPath: string;
  exitPath?: string;
  navigate: NavigateFunction;
};

function keyToMove(event: KeyboardEvent): PlayerMove | null {
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  if (event.key === "ArrowDown") return "down";
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") {
    return "rotate";
  }
  if (event.key.toLowerCase() === "z") return "rotateCCW";
  if (event.key.toLowerCase() === "a") return "rotate180";
  if (event.key === " ") return "drop";
  if (event.key.toLowerCase() === "c" || event.shiftKey) return "hold";

  return null;
}

export function useGameControls({
  socket,
  gameId,
  gameState,
  countdownActive,
  resultActive,
  returnPath,
  exitPath,
  navigate,
}: GameControlsOptions) {
  const [escProgress, setEscProgress] = useState(0);
  const [focused, setFocused] = useState(() => document.hasFocus());
  const gameStateRef = useRef(gameState);
  const countdownRef = useRef(countdownActive);
  const resultRef = useRef(resultActive);
  const lastInputAt = useRef<Partial<Record<PlayerMove, number>>>({});
  const horizontalRepeat = useRef<{
    key: "ArrowLeft" | "ArrowRight";
    timeoutId: number;
    intervalId: number | null;
  } | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
    countdownRef.current = countdownActive;
    resultRef.current = resultActive;
  }, [countdownActive, gameState, resultActive]);

  useEffect(() => {
    if (!socket) return undefined;

    let escIntervalId: number | null = null;
    let escStartedAt: number | null = null;

    const clearEsc = () => {
      if (escIntervalId !== null) window.clearInterval(escIntervalId);
      escIntervalId = null;
      escStartedAt = null;
      setEscProgress(0);
    };
    const startEsc = () => {
      if (escStartedAt !== null) return;

      escStartedAt = window.performance.now();
      escIntervalId = window.setInterval(() => {
        const startedAt = escStartedAt ?? window.performance.now();
        const progress = Math.min(
          1,
          (window.performance.now() - startedAt) / ESC_HOLD_MS,
        );
        setEscProgress(progress);

        if (progress >= 1) {
          socket.emit("game:stop");
          clearStoredActiveGame(gameId);
          clearEsc();
          navigate(exitPath ?? returnPath, { replace: true });
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
  }, [exitPath, gameId, navigate, returnPath, socket]);

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
      if (countdownRef.current || resultRef.current) return;

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

  useEffect(() => {
    const refreshFocusState = () => {
      setFocused(document.hasFocus() && document.visibilityState === "visible");
    };
    const handleFocus = () => setFocused(document.visibilityState === "visible");
    const handleBlur = () => setFocused(false);
    const handleVisibilityChange = () => {
      setFocused(document.visibilityState === "visible" && document.hasFocus());
    };

    refreshFocusState();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handleBlur);
    window.addEventListener("pageshow", refreshFocusState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handleBlur);
      window.removeEventListener("pageshow", refreshFocusState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    escProgress,
    focused,
  };
}
