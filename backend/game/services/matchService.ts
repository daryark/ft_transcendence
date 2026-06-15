import createEngine from "../domain/engine/tetrisEngine";
import {
  buildGameStats,
  initGame,
  type GameState,
} from "../domain/engine/state";
import type Room from "../domain/room";
import type RoomService from "./roomService";
import createProgressionService from "./progressionService";

type RoundEndReason = "game_over" | "objective_complete" | "round_timeout";
const COUNTDOWN_STEP_MS = 900;
const COUNTDOWN_STEPS = 5;

export type MatchService = ReturnType<typeof createMatchService>; //what is time_limit?!!

function getMatchConfig(room: Room) {
  return room.matchConfig ?? {};
}

function emitsRoundEvents(room: Room): boolean {
  return (getMatchConfig(room).roundsToWin ?? 1) > 1;
}

function getRoundLimitMs(room: Room, nextRoundIndex: number): number | null {
  const matchConfig = getMatchConfig(room);
  const roundsToWin = matchConfig.roundsToWin ?? 1;
  const isMatchPointRound = nextRoundIndex >= roundsToWin;
  const limitSeconds =
    isMatchPointRound && (matchConfig.goldenPoint ?? 0) > 0
      ? matchConfig.goldenPoint
      : (matchConfig.winByRounds ?? 0);

  return typeof limitSeconds === "number" && limitSeconds > 0
    ? limitSeconds * 1000
    : null;
}

function copyCarryStats(nextState: GameState, previousState: GameState) {
  nextState.score = previousState.score;
  nextState.lines = previousState.lines;
  nextState.piecesPlaced = previousState.piecesPlaced;
  nextState.hardDrops = previousState.hardDrops;
  nextState.holds = previousState.holds;
  nextState.currentCombo = previousState.currentCombo;
  nextState.maxCombo = previousState.maxCombo;
  nextState.maxLinesCleared = previousState.maxLinesCleared;
  nextState.clearedTwoAtOnce = previousState.clearedTwoAtOnce;
  nextState.clearedThreeAtOnce = previousState.clearedThreeAtOnce;
  nextState.tetrises = previousState.tetrises;
  nextState.reachedHalfHeight = previousState.reachedHalfHeight;
  nextState.clearedAfterHalfHeight = previousState.clearedAfterHalfHeight;
  nextState.startedAt = Date.now();
  nextState.update = buildGameStats(nextState);
}

function getStartDelayMs(room: Room) {
  if (
    room.gameConfig.mode === "solo" &&
    (room.gameConfig.preset === "40Lines" ||
      room.gameConfig.preset === "blitz")
  ) {
    return COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
  }

  return 0;
}

function buildRoomStats(room: Room, state: GameState) {
  const objective =
    room.gameConfig.mode === "solo" ? room.gameConfig.objective : undefined;

  return buildGameStats(state, objective);
}

export default function createMatchService(
  room: Room,
  roomService: RoomService,
) {
  const matchConfig = getMatchConfig(room);
  const roundEventsEnabled = emitsRoundEvents(room);
  const progressionService = createProgressionService(room);
  let active = false;
  let stockLeft = matchConfig.stock ?? 0;
  let completedRounds = 0;
  let roundTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRoundTimer() {
    if (roundTimer !== null) {
      clearTimeout(roundTimer);
      roundTimer = null;
    }
  }

  function emitGameStart(state: GameState) {
    roomService.broadcast(room.id, "game:start", {
      roomId: room.id,
      state,
      config: room.gameConfig,
    });
  }

  function emitGameUpdate(state: GameState) {
    roomService.broadcast(room.id, "game:update", state);
  }

  function emitRoundStart(state: GameState) {
    if (!roundEventsEnabled) return;

    roomService.broadcast(room.id, "round:start", {
      roomId: room.id,
      round: state.round,
      state,
      completedRounds,
      stockLeft,
      matchConfig: room.matchConfig,
    });
  }

  function emitRoundEnd(state: GameState, reason: RoundEndReason) {
    if (!roundEventsEnabled) return;

    roomService.broadcast(room.id, "round:end", {
      roomId: room.id,
      round: state.round,
      reason,
      state,
      completedRounds,
      stockLeft,
      matchConfig: room.matchConfig,
    });
  }

  function stopEngine() {
    room.engine?.stop();
    room.engine = null;
  }

  function startEngine() {
    room.engine = createEngine(room, roomService);
  }

  function scheduleRoundTimer(state: GameState) {
    clearRoundTimer();

    const roundIndex = state.round;
    const limitMs = getRoundLimitMs(room, roundIndex);
    if (limitMs === null) return;

    roundTimer = setTimeout(() => {
      roundTimer = null;

      if (!active || room.status !== "playing" || room.state !== state) return;
      completeRound(state, "round_timeout");
    }, limitMs);
  }

  function meetsSoloObjective(state: GameState): boolean {
    if (room.gameConfig.mode !== "solo") return false;

    const objective = room.gameConfig.objective;
    if (objective.winCondition === "none") return false;

    if (objective.winCondition === "score") {
      return state.score >= (objective.scoreToWin ?? Infinity);
    }

    if (objective.winCondition === "lines") {
      return state.lines >= (objective.linesToClear ?? Infinity);
    }

    if (objective.winCondition === "time") {
      const elapsedSeconds = (Date.now() - state.startedAt) / 1000;
      return elapsedSeconds >= (objective.timeLimit ?? Infinity);
    }

    return false;
  }

  function buildGameEndResult(
    reason: RoundEndReason,
    progression: ReturnType<typeof progressionService.onMatchEnd>,
  ) {
    const player = Array.from(room.players.values())[0];

    return {
      outcome: reason === "objective_complete" ? "win" : "defeat",
      stats: room.state ? buildRoomStats(room, room.state) : null,
      player: player
        ? {
            id: player.id,
            nickname: player.profile?.nickname,
            place: 1,
          }
        : undefined,
      ...(progression.length > 0 ? { progression } : {}),
    };
  }

  function startRound(nextState: GameState, carryStats = false) {
    stopEngine();

    nextState.update = buildRoomStats(room, nextState);
    room.state = nextState;
    room.status = "playing";
    startEngine();
    emitGameUpdate(nextState);
    if (roundEventsEnabled) {
      emitRoundStart(nextState);
    }
    scheduleRoundTimer(nextState);

    if (!carryStats && completedRounds === 0) {
      emitGameStart(nextState);
    }
  }

  function restartSameRound(previousState: GameState) {
    const nextState = initGame(
      previousState.rows,
      previousState.cols,
      previousState.round,
    );
    copyCarryStats(nextState, previousState);
    startRound(nextState, true);
  }

  function startNextRound(previousState: GameState) {
    const nextState = initGame(
      previousState.rows,
      previousState.cols,
      previousState.round + 1,
    );
    copyCarryStats(nextState, previousState);
    startRound(nextState, false);
  }

  function finishMatch(reason: RoundEndReason) {
    clearRoundTimer();
    active = false;
    stopEngine();
    room.status = "ended";

    const progression = progressionService.onMatchEnd({
      room,
      state: room.state,
      reason,
      completedRounds,
      stockLeft,
    });

    if (room.state) {
      emitGameUpdate(room.state);
    }

    roomService.broadcast(room.id, "game:end", {
      roomId: room.id,
      reason,
      state: room.state,
      result: buildGameEndResult(reason, progression),
    });
  }

  function completeRound(state: GameState, reason: RoundEndReason) {
    clearRoundTimer();
    emitRoundEnd(state, reason);
    completedRounds += 1;

    if (completedRounds < (matchConfig.roundsToWin ?? 1)) {
      startNextRound(state);
      return true;
    }

    finishMatch(reason);
    return true;
  }

  function handleGameOver(state: GameState) {
    if (
      room.gameConfig.mode === "solo" &&
      room.gameConfig.objective.winCondition === "none"
    ) {
      restartSameRound(state);
      return true;
    }

    if (stockLeft > 0) {
      stockLeft -= 1;
      restartSameRound(state);
      return true;
    }

    return completeRound(state, "game_over");
  }

  function evaluate(state: GameState) {
    if (!active || room.status !== "playing" || room.state !== state)
      return false;

    if (state.gameOver) {
      return handleGameOver(state);
    }

    if (meetsSoloObjective(state)) {
      return completeRound(state, "objective_complete");
    }

    return false;
  }

  function start() {
    if (active) return;

    active = true;
    room.status = "playing";
    progressionService.onMatchStart(room);

    const { boardHeight, boardWidth } = room.gameConfig.general;
    const initialState = initGame(
      boardHeight,
      boardWidth,
      1,
      Date.now() + getStartDelayMs(room),
    );
    initialState.update = buildRoomStats(room, initialState);

    room.state = initialState;
    startEngine();
    emitGameStart(initialState);
    if (roundEventsEnabled) {
      emitRoundStart(initialState);
    }
    scheduleRoundTimer(initialState);
  }

  function stop() {
    active = false;
    clearRoundTimer();
    stopEngine();
  }

  return {
    start,
    evaluate,
    stop,
  };
}
