// @ts-nocheck
import createEngine, { TICK_MS } from "../../engine/tetrisEngine";
import { initGame } from "../../engine/state";
import { createGarbageService } from "../../../services/garbageService.js";
import { emitAchievementUnlocked } from "../../../../sockets/realtime";

const COUNTDOWN_STEP_MS = 900;
const COUNTDOWN_STEPS = 5;
const quickplayEngines = new Map();

function getPlayerName(player) {
  return player?.profile?.nickname ?? String(player?.id ?? "PLAYER");
}

function getFirstPlayerState(engine) {
  return engine.playerEngines.values().next().value?.room.state ?? null;
}

function getActivePlayerIds(engine) {
  const activePlayerIds = [];

  for (const [playerId, playerEngine] of engine.playerEngines.entries()) {
    const state = playerEngine.room.state;

    if (
      playerEngine.room.status === "playing" &&
      state &&
      !state.gameOver &&
      !engine.eliminatedPlayerIds.has(playerId)
    ) {
      activePlayerIds.push(playerId);
    }
  }

  return activePlayerIds;
}

function getMeters(state) {
  if (!state) return 0;

  return Number((state.lines + state.piecesPlaced / 100).toFixed(2));
}

function getQuickplayStats(state, meta) {
  const meters = Math.max(getMeters(state), meta?.meters ?? 0);
  const climbRank = Math.max(1, Math.floor(meters / 50) + 1);

  return {
    meters: Number(meters.toFixed(2)),
    floor: Math.min(10, Math.floor(meters / 150) + 1),
    climbRank,
    climbSpeed: Number((climbRank * 0.25).toFixed(2)),
  };
}

function decorateState(state, meta) {
  if (!state) return state;

  const quickplay = getQuickplayStats(state, meta);
  state.quickplay = quickplay;
  state.update = {
    ...state.update,
    quickplay,
  };

  return state;
}

function serializeQuickplayGame(room, engine) {
  const players = {};

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    const playerEngine = engine.playerEngines.get(playerId);
    const state = decorateState(
      playerEngine?.room.state ?? null,
      engine.playerMeta.get(playerId),
    );

    players[playerId] = {
      id: player.id,
      username: getPlayerName(player),
      rank: player.profile?.rank,
      state,
      gameOver: Boolean(
        state?.gameOver || engine.eliminatedPlayerIds.has(playerId),
      ),
    };
  }

  const activePlayerIds = getActivePlayerIds(engine);

  return {
    roomId: room.id,
    status: room.status,
    config: room.gameConfig,
    players,
    state: decorateState(getFirstPlayerState(engine), null),
    startedAt: engine.startedAt,
    winnerId: activePlayerIds.length === 1 ? activePlayerIds[0] : null,
  };
}

function createPlayerEngineRoom(room, player, startedAt) {
  const { boardHeight, boardWidth } = room.gameConfig.general;
  const state = initGame(boardHeight, boardWidth, 1, startedAt, {
    bagSeed: `${room.id}:quickplay`,
  });

  return {
    id: `${room.id}:${player.id}`,
    status: "playing",
    players: new Map([[player.id, player]]),
    spectators: new Map(),
    state,
    engine: null,
    roomConfig: room.roomConfig,
    matchConfig: room.matchConfig,
    gameConfig: room.gameConfig,
  };
}

function getStateMap(engine) {
  const states = new Map();

  for (const [playerId, playerEngine] of engine.playerEngines.entries()) {
    if (playerEngine.room.state) {
      states.set(playerId, playerEngine.room.state);
    }
  }

  return states;
}

function estimateAttackLines(linesCleared, state) {
  if (linesCleared <= 1) return 0;

  const lineAttack = linesCleared === 2 ? 1 : linesCleared === 3 ? 2 : 4;
  const boardEmpty = state?.board?.every((row) => row.every((cell) => !cell));
  const allClearBonus = boardEmpty ? 3 : 0;

  return lineAttack + allClearBonus;
}

function updateClimbMeta(engine, playerId, state, linesCleared) {
  const meta = engine.playerMeta.get(playerId) ?? {
    meters: 0,
    lastAt: Date.now(),
    attackLines: 0,
    kos: 0,
  };
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - meta.lastAt) / 1000);
  const climbRank = Math.max(1, Math.floor(meta.meters / 50) + 1);
  const passiveMeters = elapsedSeconds * climbRank * 0.25;
  const attackLines = estimateAttackLines(linesCleared, state);

  meta.meters += passiveMeters + attackLines * 1.5;
  meta.attackLines += attackLines;
  meta.lastAt = now;
  engine.playerMeta.set(playerId, meta);
}

function getRegisteredUserId(player) {
  if (!player || player.identityType === "anonymous") return null;

  const userId = Number(player.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function persistQuickplayResults(room, engine, winnerId) {
  const startedAt = engine.startedAt;
  const elapsedMs = Math.max(0, Date.now() - startedAt);

  for (const player of room.players.values()) {
    const userId = getRegisteredUserId(player);
    if (!userId) continue;

    const playerId = String(player.id);
    const playerState = engine.playerEngines.get(playerId)?.room?.state;
    const meta = engine.playerMeta.get(playerId);
    const quickplayStats = getQuickplayStats(playerState, meta);

    try {
      const { persistGameResult } = await import("../../../../prisma/playerStats.js");
      const achievements = await persistGameResult({
        userId,
        mode: "quickPlay",
        score: playerState?.score ?? 0,
        achievementScore: playerState?.score ?? 0,
        metricValue: quickplayStats.meters,
        elapsedMs,
        lines: playerState?.lines ?? 0,
        piecesPlaced: playerState?.piecesPlaced ?? 0,
        hardDrops: playerState?.hardDrops ?? 0,
        holds: playerState?.holds ?? 0,
        maxCombo: playerState?.maxCombo ?? 0,
        maxLinesCleared: playerState?.maxLinesCleared ?? 0,
        clearedTwoAtOnce: playerState?.clearedTwoAtOnce ?? false,
        clearedThreeAtOnce: playerState?.clearedThreeAtOnce ?? false,
        tetrises: playerState?.tetrises ?? 0,
        clearedAfterHalfHeight: playerState?.clearedAfterHalfHeight ?? false,
        roundsPlayed: 1,
        stats: {
          lines: playerState?.lines ?? 0,
          piecesPlaced: playerState?.piecesPlaced ?? 0,
          hardDrops: playerState?.hardDrops ?? 0,
          holds: playerState?.holds ?? 0,
          maxCombo: playerState?.maxCombo ?? 0,
          maxLinesCleared: playerState?.maxLinesCleared ?? 0,
          clearedTwoAtOnce: playerState?.clearedTwoAtOnce ?? false,
          clearedThreeAtOnce: playerState?.clearedThreeAtOnce ?? false,
          tetrises: playerState?.tetrises ?? 0,
          durationMs: elapsedMs,
          clearedAfterHalfHeight: playerState?.clearedAfterHalfHeight ?? false,
        },
        result: playerId === String(winnerId) ? "win" : "lose",
      });
      emitAchievementUnlocked(userId, achievements ?? []);
    } catch (error) {
      console.error("Failed to persist quickplay result", error);
    }
  }
}

function finishQuickplay(room, roomService, engine, reason = "game_over") {
  if (room.status !== "playing") return false;

  const activePlayerIds = getActivePlayerIds(engine);
  if (activePlayerIds.length > 1) return false;

  const winnerId = activePlayerIds[0] ?? null;
  room.status = "ended";
  room.state = getFirstPlayerState(engine);

  const payload = {
    ...serializeQuickplayGame(room, engine),
    reason,
    winnerId,
    result: {
      outcome: winnerId ? "win" : "defeat",
      stats: room.state?.update,
      progression: [],
    },
  };

  roomService.broadcast(room.id, "game:update", payload);
  roomService.broadcast(room.id, "game:end", payload);
  void persistQuickplayResults(room, engine, winnerId);
  engine.stop();
  room.engine = null;
  quickplayEngines.delete(room.id);
  return true;
}

export function createQuickplayEngine(room, roomService) {
  const startedAt = Date.now() + COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
  const playerEngines = new Map();
  const eliminatedPlayerIds = new Set();
  const lastPiecesPlaced = new Map();
  const playerMeta = new Map();
  const garbageService = createGarbageService(room.gameConfig.garbage);

  const quickplayEngine = {
    startedAt,
    playerEngines,
    eliminatedPlayerIds,
    garbageService,
    playerMeta,
    interval: null,
    pushInput(playerId, input) {
      if (room.status !== "playing") return;

      const playerEngine = playerEngines.get(String(playerId));
      if (!playerEngine || playerEngine.room.status !== "playing") return;

      playerEngine.engine.pushInput(input);
    },
    stop() {
      if (quickplayEngine.interval) {
        clearInterval(quickplayEngine.interval);
        quickplayEngine.interval = null;
      }

      for (const playerEngine of playerEngines.values()) {
        playerEngine.engine?.stop?.();
        playerEngine.room.status = "ended";
      }

      quickplayEngines.delete(room.id);
    },
  };

  function handlePlayerOut(playerId, playerEngine, reason = "game_over") {
    if (eliminatedPlayerIds.has(playerId)) return false;

    eliminatedPlayerIds.add(playerId);
    playerEngine.engine?.stop?.();
    playerEngine.room.status = "ended";
    return finishQuickplay(room, roomService, quickplayEngine, reason);
  }

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    const playerRoom = createPlayerEngineRoom(room, player, startedAt);
    const playerEngine = {
      player,
      room: playerRoom,
      engine: null,
      roomService: null,
    };

    garbageService.syncState(playerId, playerRoom.state, startedAt);
    lastPiecesPlaced.set(playerId, playerRoom.state?.piecesPlaced ?? 0);
    playerMeta.set(playerId, {
      meters: 0,
      lastAt: startedAt,
      attackLines: 0,
      kos: 0,
    });

    const playerRoomService = {
      broadcast(_roomId, event, payload) {
        if (event === "game:update") {
          const state = payload ?? playerEngine.room.state;
          playerEngine.room.state = state;

          const previousPiecesPlaced = lastPiecesPlaced.get(playerId) ?? 0;
          const nextPiecesPlaced = state?.piecesPlaced ?? previousPiecesPlaced;

          if (nextPiecesPlaced > previousPiecesPlaced) {
            const linesCleared = state?.update?.linesCleared ?? 0;
            updateClimbMeta(quickplayEngine, playerId, state, linesCleared);
            garbageService.handlePieceLocked({
              playerId,
              state,
              linesCleared,
              activePlayerIds: getActivePlayerIds(quickplayEngine),
              stateMap: getStateMap(quickplayEngine),
            });
            lastPiecesPlaced.set(playerId, nextPiecesPlaced);

            if (state?.gameOver && handlePlayerOut(playerId, playerEngine)) {
              return;
            }
            if (finishQuickplay(room, roomService, quickplayEngine)) {
              return;
            }
          }
        }

        if (event === "game:end") {
          playerEngine.room.state = payload?.state ?? playerEngine.room.state;
          handlePlayerOut(playerId, playerEngine, payload?.reason);
        }
      },
    };

    playerEngine.roomService = playerRoomService;
    playerEngine.engine = createEngine(playerRoom, playerRoomService);
    playerRoom.engine = playerEngine.engine;
    playerEngines.set(playerId, playerEngine);
  }

  quickplayEngine.interval = setInterval(() => {
    if (room.status !== "playing") return;

    for (const [playerId, playerEngine] of playerEngines.entries()) {
      const state = playerEngine.room.state;
      updateClimbMeta(quickplayEngine, playerId, state, 0);

      if (state?.gameOver) {
        if (handlePlayerOut(playerId, playerEngine)) return;
      }
    }

    room.state = getFirstPlayerState(quickplayEngine);
    if (finishQuickplay(room, roomService, quickplayEngine)) return;

    roomService.broadcast(
      room.id,
      "game:update",
      serializeQuickplayGame(room, quickplayEngine),
    );
  }, TICK_MS);

  quickplayEngines.set(room.id, quickplayEngine);
  return quickplayEngine;
}

export function startQuickplay(room, roomService) {
  if (room.status === "playing") return;
  if (room.players.size < 2) {
    roomService.broadcast(room.id, "server:error", {
      reason: "NEED_TWO_PLAYERS",
    });
    return;
  }

  room.status = "playing";
  const engine = createQuickplayEngine(room, roomService);
  room.engine = engine;
  room.state = getFirstPlayerState(engine);

  roomService.broadcast(room.id, "game:start", serializeQuickplayGame(room, engine));
}

export function removeQuickplayParticipant(roomService, roomId, playerId, role) {
  const room = roomService.getRoom(roomId);
  if (!room || room.gameConfig.mode !== "quickplay") return false;

  const normalizedPlayerId = String(playerId);
  const engine = room.engine;

  if (role === "spectator") {
    roomService.removeSpectator(roomId, playerId);
    if (roomService.isEmpty(roomId)) {
      roomService.deleteRoom(roomId);
    }
    return true;
  }

  const playerEngine = engine?.playerEngines?.get?.(normalizedPlayerId);
  playerEngine?.engine?.stop?.();
  if (playerEngine?.room) {
    playerEngine.room.status = "ended";
  }
  engine?.eliminatedPlayerIds?.add?.(normalizedPlayerId);
  roomService.removePlayer(roomId, playerId);

  if (roomService.isEmpty(roomId)) {
    engine?.stop?.();
    roomService.deleteRoom(roomId);
    return true;
  }

  if (engine && finishQuickplay(room, roomService, engine, "game_over")) {
    return true;
  }

  return true;
}
