// @ts-nocheck
import { applyConfigPatch, createConfig } from "../../../config/configBase";
import { ConfigPatchSchema } from "../../../config/config.schema";
import {
  clearRoomMessages,
  emitRoomSystemMessage,
  getRoomMessages,
} from "../../../services/roomChatService";
import {
  createMultiplayerEngine,
  getActiveMultiplayerPlayerIds,
  getFirstMultiplayerState,
  isActiveMultiplayerPlayer,
  serializeMultiplayerGame,
} from "../../../services/multiplayerEngineService";

const JOIN_PREFIX = "JOIN:";
const customRoomHosts = new Map();
const customEngines = new Map();
const customRoomScores = new Map();
const customAutoStartTimers = new Map();
const CONFIG_FIELD_NAMES = {
  roomName: "ROOM NAME",
  maxPlayers: "PLAYER LIMIT",
  public: "PUBLIC ROOM",
  anonymousAllowed: "ALLOW ANONYMOUS USERS",
  autoStart: "AUTO START",
  roundsToWin: "ROUNDS TO WIN",
  winByRounds: "WIN BY ROUNDS",
  goldenPoint: "GOLDEN POINT",
  stock: "STOCK",
  bagType: "BAG TYPE",
  boardWidth: "BOARD WIDTH",
  boardHeight: "BOARD HEIGHT",
  hold: "HOLD",
  nextPieces: "NEXT PIECES",
  showShadowPiece: "SHADOW PIECE",
  lockDelay: "LOCK DELAY",
  lockDelayDecrease: "LOCK DECREASE",
  minimumLockDelay: "MIN LOCK DELAY",
  gravity: "GRAVITY",
  gravityIncrease: "GRAVITY INCREASE",
  gravitMarginTime: "GRAVITY MARGIN TIME",
  garbageMult: "GARBAGE MULT",
  garbageCap: "GARBAGE CAP",
  garbageMaxCap: "GARBAGE MAX CAP",
  allClearGarbage: "ALL CLEAR GARBAGE",
  garbageDelay: "GARBAGE DELAY",
  garbageDelayOnClear: "DELAY ON CLEAR",
  garbageTargeting: "TARGETING",
  garbageColumnChangeChance: "HOLE CHANGE CHANCE",
};

function emitError(socket, reason) {
  socket.emit("server:error", { reason });
}

function formatConfigError(error) {
  return error.issues
    ?.map((issue) => {
      const field = issue.path?.at(-1) || "config";
      return CONFIG_FIELD_NAMES[field] ?? String(field).toUpperCase();
    })
    .filter((field, index, fields) => fields.indexOf(field) === index)
    .join("\n") || "INVALID_CONFIG";
}

function normalizeRoomName(roomName) {
  return String(roomName ?? "CUSTOM ROOM").trim().toUpperCase();
}

function getPlayerName(player) {
  return player?.profile?.nickname ?? String(player?.id ?? "PLAYER");
}

function emitSystemMessage(roomService, room, message, actor) {
  emitRoomSystemMessage(roomService, room, message, actor);
}

function getRoomScores(room) {
  if (!customRoomScores.has(room.id)) {
    customRoomScores.set(room.id, new Map());
  }

  return customRoomScores.get(room.id);
}

function getWaitingPlayers(room) {
  if (!room.waitingPlayers) {
    room.waitingPlayers = new Map();
  }

  return room.waitingPlayers;
}

function getVisibleRoomPlayers(room) {
  return [
    ...Array.from(room.players.values()),
    ...Array.from(getWaitingPlayers(room).values()),
    ...Array.from(room.spectators?.values() ?? []),
  ];
}

function promoteWaitingPlayers(room) {
  const waitingPlayers = getWaitingPlayers(room);

  for (const player of waitingPlayers.values()) {
    if (!room.players.has(player.id)) {
      player.role = "player";
      player.roomId = room.id;
      room.players.set(player.id, player);
    }
  }

  waitingPlayers.clear();
  ensureRoomHost(room);
}

function getPlayerRoomStats(room, playerId) {
  const scores = getRoomScores(room);
  const id = String(playerId);
  const stats = scores.get(id) ?? { wins: 0, games: 0 };

  scores.set(id, stats);
  return stats;
}

function serializePlayer(player, hostId, room) {
  const stats = getPlayerRoomStats(room, player.id);

  return {
    id: player.id,
    username: getPlayerName(player),
    role: player.role,
    isHost: player.id === hostId,
    connected: player.connected,
    matchWins: stats.wins,
    matchTotalGames: stats.games,
  };
}

function serializeRoom(room) {
  const hostId = customRoomHosts.get(room.id);
  const autoStartTimer = customAutoStartTimers.get(room.id);

  return {
    roomId: room.id,
    roomCode: room.id,
    roomName: room.roomConfig.roomName,
    visibility: room.roomConfig.public ? "public" : "private",
    status: room.status,
    autoStartEndsAt: autoStartTimer?.endsAt ?? null,
    players: getVisibleRoomPlayers(room).map((player) =>
      serializePlayer(player, hostId, room),
    ),
    spectators: Array.from(room.spectators?.values() ?? []).map((spectator) =>
      serializePlayer(spectator, hostId, room),
    ),
    config: {
      roomConfig: room.roomConfig,
      matchConfig: room.matchConfig,
      gameConfig: room.gameConfig,
    },
    chatMessages: getRoomMessages(room),
  };
}

function broadcastRoomUpdate(roomService, room) {
  roomService.broadcast(room.id, "room:update", serializeRoom(room));
  roomService.emitPublicRoomList?.();
}

function isRegisteredPlayer(player) {
  return player?.identityType === "registered";
}

function getNextHostId(room) {
  const players = Array.from(room.players.values());
  const waitingPlayers = Array.from(getWaitingPlayers(room).values());

  if (!room.roomConfig.public) {
    return (
      players[0]?.id ??
      waitingPlayers[0]?.id ??
      Array.from(room.spectators?.values() ?? [])[0]?.id ??
      null
    );
  }

  return (
    players.find(isRegisteredPlayer)?.id ??
    waitingPlayers.find(isRegisteredPlayer)?.id ??
    null
  );
}

function ensureRoomHost(room) {
  const currentHostId = customRoomHosts.get(room.id);
  const currentHost = currentHostId
    ? room.players.get(currentHostId) ??
      getWaitingPlayers(room).get(currentHostId) ??
      room.spectators?.get(currentHostId)
    : null;

  if (
    currentHost &&
    (!room.roomConfig.public || isRegisteredPlayer(currentHost))
  ) {
    return currentHostId;
  }

  const nextHostId = getNextHostId(room);

  if (nextHostId) {
    customRoomHosts.set(room.id, nextHostId);
  } else {
    customRoomHosts.delete(room.id);
  }

  return nextHostId;
}

function calculateCustomXpDelta(elapsedMs, isWinner) {
  const survivedSeconds = Math.max(0, elapsedMs / 1000);
  const winnerXp = Math.min(500, 220 + survivedSeconds * 2.4);

  return Math.round(isWinner ? winnerXp : Math.max(0, winnerXp - 100));
}

function getRoundLeaders(roundWins) {
  const entries = Array.from(roundWins.entries()).sort((a, b) => b[1] - a[1]);

  return {
    leaderWins: entries[0]?.[1] ?? 0,
    secondWins: entries[1]?.[1] ?? 0,
  };
}

function shouldFinishMatch(room, winnerId, round) {
  if (!winnerId) return true;

  const roundWins = room.roundWins ?? new Map();
  const roundsToWin = room.matchConfig?.roundsToWin ?? 1;
  const winByRounds = room.matchConfig?.winByRounds ?? 0;
  const goldenPoint = room.matchConfig?.goldenPoint ?? 0;
  const winnerWins = roundWins.get(String(winnerId)) ?? 0;
  const { leaderWins, secondWins } = getRoundLeaders(roundWins);

  if (goldenPoint > 0 && round >= goldenPoint) return true;
  if (winnerWins < roundsToWin) return false;
  if (winByRounds > 0 && leaderWins - secondWins < winByRounds) return false;
  return true;
}

function clearAutoStartTimer(room) {
  const timer = customAutoStartTimers.get(room.id);
  if (!timer) return;

  clearTimeout(timer.timeout);
  customAutoStartTimers.delete(room.id);
}

function notifyAchievementUnlocks(userId, achievements) {
  if (!achievements?.length) return;

  void import("../../../../notifications/service.js")
    .then(({ notifyAchievementUnlocks: notify }) => notify(userId, achievements))
    .catch((error) => {
      console.error("Failed to notify custom achievements", error);
    });
}

function serializeCustomGame(room, engine) {
  return serializeMultiplayerGame(room, engine, getPlayerName);
}

function createCustomMultiplayerEngine(room, roomService) {
  return createMultiplayerEngine({
    room,
    roomService,
    onMaybeEnd: (engine, reason) => maybeEndVersus(room, roomService, engine, reason),
    onStop: () => customEngines.delete(room.id),
  });
}

function stopCustomEngine(roomId) {
  const engine = customEngines.get(roomId);
  if (!engine) return;

  engine.stop();
}

function maybeEndVersus(room, roomService, engine, reason = "game_over") {
  if (room.status !== "playing") return false;

  const activePlayerIds = getActiveMultiplayerPlayerIds(engine);
  if (activePlayerIds.length > 1) return false;
  const winnerId = activePlayerIds[0] ?? null;
  const roundsToWin = room.matchConfig?.roundsToWin ?? 1;
  const winByRounds = room.matchConfig?.winByRounds ?? 0;
  const goldenPoint = room.matchConfig?.goldenPoint ?? 0;
  const roundWins = room.roundWins ?? new Map();
  const round = room.roundNumber ?? 1;

  for (const playerId of engine.playerEngines.keys()) {
    getPlayerRoomStats(room, playerId).games += 1;
  }

  if (winnerId) {
    getPlayerRoomStats(room, winnerId).wins += 1;
    roundWins.set(String(winnerId), (roundWins.get(String(winnerId)) ?? 0) + 1);
  }
  room.roundWins = roundWins;

  const serializedRoundWins = Object.fromEntries(roundWins.entries());

  if (winnerId && room.players.size > 1 && !shouldFinishMatch(room, winnerId, round)) {
    const payload = {
      ...serializeCustomGame(room, engine),
      reason,
      round,
      mode: room.gameConfig.mode,
      winnerId,
      roundWins: serializedRoundWins,
      roundsToWin,
      label: null,
    };

    roomService.broadcast(room.id, "round:end", payload);
    engine.stop();
    room.engine = null;
    room.roundNumber = round + 1;
    setTimeout(() => {
      if (room.status !== "playing") return;
      const nextEngine = createCustomMultiplayerEngine(room, roomService);
      room.engine = nextEngine;
      room.state = getFirstMultiplayerState(nextEngine);
      customEngines.set(room.id, nextEngine);
      roomService.broadcast(room.id, "game:start", serializeCustomGame(room, nextEngine));
    }, 2400);
    return true;
  }

  room.status = "ended";
  room.state = getFirstMultiplayerState(engine);
  const sharedElapsedMs = Math.max(
    0,
    ...Array.from(engine.playerEngines.values()).map((playerEngine) => {
      const state = playerEngine.room?.state;
      return (
        state?.update?.elapsedMs ??
        (state?.startedAt ? Math.max(0, Date.now() - state.startedAt) : 0)
      );
    }),
  );

  const payload = {
    ...serializeCustomGame(room, engine),
    reason,
    winnerId,
    round,
    roundWins: serializedRoundWins,
    roundsToWin,
    winByRounds,
    goldenPoint,
    result: {
      outcome: winnerId ? "win" : "defeat",
      stats: room.state?.update,
      progression: [],
    },
  };

  for (const player of room.players.values()) {
    const userId = Number(player.id);
    if (!Number.isInteger(userId) || userId <= 0 || player.identityType === "anonymous") {
      continue;
    }

    const playerId = String(player.id);
    const playerState = engine.playerEngines.get(playerId)?.room?.state;
    const isWinner = playerId === String(winnerId);
    const xpDelta = calculateCustomXpDelta(sharedElapsedMs, isWinner);

    payload.result.progression.push({
      playerId,
      xpDelta,
      level: player.profile?.level ?? 1,
      xp: player.profile?.xp ?? 0,
    });

    void import("../../../../prisma/playerStats.js")
      .then(async ({ persistGameResult }) => {
        const achievements = await persistGameResult({
          userId,
          mode: "customGame",
          score: playerState?.score ?? 0,
          achievementScore: playerState?.score ?? 0,
          elapsedMs: sharedElapsedMs,
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
          roundsPlayed: round,
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
            durationMs: sharedElapsedMs,
            clearedAfterHalfHeight: playerState?.clearedAfterHalfHeight ?? false,
          },
          result: isWinner ? "win" : "lose",
        });
        notifyAchievementUnlocks(userId, achievements ?? []);
      })
      .catch((error) => {
        console.error("Failed to persist custom progression", error);
      });
  }

  emitSystemMessage(roomService, room, "game finished");
  roomService.broadcast(room.id, "game:update", payload);
  roomService.broadcast(room.id, "game:end", payload);
  engine.stop();
  room.status = "lobby";
  room.engine = null;
  room.roundWins = undefined;
  room.roundNumber = undefined;
  promoteWaitingPlayers(room);
  broadcastRoomUpdate(roomService, room);
  return true;
}

export function removeCustomRoomParticipant(
  roomService,
  roomId,
  playerId,
  role,
) {
  const room = roomService.getRoom(roomId);
  if (!room || room.gameConfig.mode !== "custom") return false;

  const normalizedPlayerId = String(playerId);
  const engine = room.engine;
  const waitingPlayers = getWaitingPlayers(room);
  const actualRole =
    room.players.has(playerId) || waitingPlayers.has(playerId)
      ? "player"
      : room.spectators?.has(playerId)
        ? "spectator"
        : role;

  if (actualRole === "player") {
    const waitingPlayer = waitingPlayers.get(playerId);
    const leavingPlayer = room.players.get(playerId) ?? waitingPlayer;
    if (!leavingPlayer) return false;

    const leavingPlayerName = getPlayerName(leavingPlayer);
    const playerEngine = engine?.playerEngines?.get?.(normalizedPlayerId);
    playerEngine?.engine?.stop?.();
    if (playerEngine?.room) {
      playerEngine.room.status = "ended";
    }
    engine?.eliminatedPlayerIds?.add?.(normalizedPlayerId);
    if (waitingPlayer) {
      waitingPlayer.roomId = undefined;
      waitingPlayer.role = undefined;
      waitingPlayers.delete(playerId);
    } else {
      roomService.removePlayer(roomId, playerId);
    }

    if (room.players.size === 0 && waitingPlayers.size === 0) {
      if ((room.spectators?.size ?? 0) > 0) {
        engine?.stop?.();
        stopCustomEngine(room.id);
        room.status = "lobby";
        room.engine = null;
        room.roundWins = undefined;
        room.roundNumber = undefined;
        ensureRoomHost(room);
        emitSystemMessage(roomService, room, "left the room", leavingPlayerName);
        broadcastRoomUpdate(roomService, room);
        return true;
      }

      customRoomHosts.delete(room.id);
      customRoomScores.delete(room.id);
      clearAutoStartTimer(room);
      clearRoomMessages(room.id);
      stopCustomEngine(room.id);
      roomService.deleteRoom(room.id);
      roomService.emitPublicRoomList?.();
      return true;
    }

    ensureRoomHost(room);
    emitSystemMessage(roomService, room, "left the room", leavingPlayerName);
    maybeAutoStart(roomService, room);

    if (engine && maybeEndVersus(room, roomService, engine, "game_over")) {
      return true;
    }

    broadcastRoomUpdate(roomService, room);
    return true;
  }

  const spectator = room.spectators?.get(playerId);
  if (!spectator) return false;

  const spectatorName = getPlayerName(spectator);
  roomService.removeSpectator(roomId, playerId);
  ensureRoomHost(room);
  emitSystemMessage(roomService, room, "left the room", spectatorName);
  broadcastRoomUpdate(roomService, room);
  return true;
}

function startCustomVersus(room, roomService) {
  if (room.status === "playing") return;
  clearAutoStartTimer(room);
  promoteWaitingPlayers(room);
  if (room.players.size < 2) {
    roomService.broadcast(room.id, "server:error", {
      reason: "NEED_TWO_PLAYERS",
    });
    return;
  }

  stopCustomEngine(room.id);
  room.status = "playing";
  room.roundWins = new Map();
  room.roundNumber = 1;

  const engine = createCustomMultiplayerEngine(room, roomService);
  room.engine = engine;
  room.state = getFirstMultiplayerState(engine);
  customEngines.set(room.id, engine);

  emitSystemMessage(roomService, room, "game started");
  roomService.broadcast(
    room.id,
    "game:start",
    serializeCustomGame(room, engine),
  );
}

export function startCustomRoom(roomService, roomId, playerId) {
  const room = roomService.getRoom(roomId);
  if (!room || room.gameConfig.mode !== "custom") return { ok: false, reason: "ROOM_NOT_FOUND" };

  if (customRoomHosts.get(room.id) !== playerId) {
    return { ok: false, reason: "ONLY_HOST_CAN_START_ROOM" };
  }

  startCustomVersus(room, roomService);
  return { ok: true };
}

function parseJoinCode(payload) {
  const roomName = payload?.roomConfig?.roomName;

  if (typeof roomName !== "string") {
    return null;
  }

  const trimmed = roomName.trim();
  if (!trimmed.toUpperCase().startsWith(JOIN_PREFIX)) {
    return null;
  }

  return trimmed.slice(JOIN_PREFIX.length).trim().toUpperCase();
}

function getMaxPlayers(room) {
  const maxPlayers = room.roomConfig.maxPlayers;

  return typeof maxPlayers === "number" && Number.isFinite(maxPlayers)
    ? maxPlayers
    : Infinity;
}

function canJoinAsPlayer(room, player) {
  if (room.players.has(player.id)) {
    return true;
  }

  if (getWaitingPlayers(room).has(player.id)) {
    return true;
  }

  return room.players.size + getWaitingPlayers(room).size < getMaxPlayers(room);
}

function joinExistingRoom(socket, roomService, player, roomCode) {
  const room = roomService.getRoom(roomCode);

  if (!room || room.gameConfig.mode !== "custom") {
    emitError(socket, "ROOM_NOT_FOUND");
    return null;
  }

  const wasAlreadyPlayer = room.players.has(player.id);
  const waitingPlayers = getWaitingPlayers(room);
  const wasAlreadyWaiting = waitingPlayers.has(player.id);
  const wasAlreadySpectator = room.spectators?.has(player.id) ?? false;
  const isExistingParticipant =
    wasAlreadyPlayer || wasAlreadyWaiting || wasAlreadySpectator;

  if (
    !isExistingParticipant &&
    player.identityType === "anonymous" &&
    room.roomConfig.anonymousAllowed === false
  ) {
    emitError(socket, "ANONYMOUS_NOT_ALLOWED");
    return null;
  }

  if (wasAlreadySpectator) {
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = "spectator";
    socket.emit("room:update", serializeRoom(room));
    return roomService.getRoomState(room.id);
  }

  if (!canJoinAsPlayer(room, player)) {
    if (room.spectators) {
      roomService.addSpectator(room.id, player);
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.role = "spectator";
      if (!wasAlreadySpectator) {
        emitSystemMessage(roomService, room, "joined the room", getPlayerName(player));
      }
      socket.emit("room:update", serializeRoom(room));
      if (!wasAlreadySpectator) {
        broadcastRoomUpdate(roomService, room);
      }
      return roomService.getRoomState(room.id);
    }

    emitError(socket, "ROOM_FULL");
    return null;
  }

  if (room.status === "playing" && !wasAlreadyPlayer) {
    player.roomId = room.id;
    player.role = "player";
    waitingPlayers.set(player.id, player);
  } else {
    roomService.addPlayer(room.id, player);
    ensureRoomHost(room);
  }
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.role = "player";
  if (!wasAlreadyPlayer && !wasAlreadyWaiting) {
    emitSystemMessage(roomService, room, "joined the room", getPlayerName(player));
  }
  socket.emit("room:update", serializeRoom(room));
  if (!wasAlreadyPlayer && !wasAlreadyWaiting) {
    broadcastRoomUpdate(roomService, room);
    maybeAutoStart(roomService, room);
  }

  return roomService.getRoomState(room.id);
}

function createCustomRoom(socket, roomService, player, payload) {
  const config = applyConfigPatch(createConfig("custom"), payload);
  config.roomConfig.roomName = normalizeRoomName(config.roomConfig.roomName);
  const room = roomService.createRoom(config);
  room.spectators ??= new Map();

  customRoomHosts.set(room.id, player.id);
  customRoomScores.set(room.id, new Map());
  roomService.addPlayer(room.id, player);
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.role = "player";
  emitSystemMessage(roomService, room, "joined the room", getPlayerName(player));
  socket.emit("room:update", serializeRoom(room));
  broadcastRoomUpdate(roomService, room);
  maybeAutoStart(roomService, room);

  return roomService.getRoomState(room.id);
}

export function switchCustomRoomRole(roomService, roomId, playerId, nextRole) {
  const room = roomService.getRoom(roomId);
  if (!room || room.gameConfig.mode !== "custom") return { ok: false, reason: "ROOM_NOT_FOUND" };

  room.spectators ??= new Map();
  const waitingPlayers = getWaitingPlayers(room);
  const player = room.players.get(playerId) ?? waitingPlayers.get(playerId) ?? room.spectators.get(playerId);
  if (!player) return { ok: false, reason: "PLAYER_NOT_FOUND" };

  if (nextRole === "spectator") {
    if (
      room.status === "playing" &&
      room.players.has(playerId) &&
      isActiveMultiplayerPlayer(room.engine, playerId)
    ) {
      return { ok: false, reason: "PLAYER_IN_ACTIVE_GAME" };
    }

    waitingPlayers.delete(playerId);
    room.players.delete(playerId);
    player.role = "spectator";
    player.roomId = room.id;
    room.spectators.set(playerId, player);
    ensureRoomHost(room);
    broadcastRoomUpdate(roomService, room);
    return { ok: true, role: "spectator" };
  }

  if (nextRole === "player") {
    if (player.identityType === "anonymous" && room.roomConfig.anonymousAllowed === false) {
      return { ok: false, reason: "ANONYMOUS_NOT_ALLOWED" };
    }

    if (!canJoinAsPlayer(room, player)) {
      return { ok: false, reason: "ROOM_FULL" };
    }

    room.spectators.delete(playerId);
    player.role = "player";
    player.roomId = room.id;
    if (room.status === "playing") {
      waitingPlayers.set(playerId, player);
    } else {
      room.players.set(playerId, player);
    }
    ensureRoomHost(room);
    broadcastRoomUpdate(roomService, room);
    maybeAutoStart(roomService, room);
    return { ok: true, role: "player" };
  }

  return { ok: false, reason: "INVALID_ROLE" };
}

function maybeAutoStart(roomService, room) {
  const autoStart = room.roomConfig.autoStart;

  if (
    room.status !== "lobby" ||
    typeof autoStart !== "number" ||
    autoStart <= 0 ||
    room.players.size < 2
  ) {
    clearAutoStartTimer(room);
    return;
  }

  if (!customAutoStartTimers.has(room.id)) {
    const endsAt = Date.now() + autoStart * 1000;
    customAutoStartTimers.set(room.id, {
      endsAt,
      timeout: setTimeout(() => {
        customAutoStartTimers.delete(room.id);
        if (room.status === "lobby" && room.players.size >= 2) {
          startCustomVersus(room, roomService);
        } else {
          broadcastRoomUpdate(roomService, room);
        }
      }, autoStart * 1000),
    });
    emitSystemMessage(roomService, room, `autostart in ${autoStart} seconds`);
    broadcastRoomUpdate(roomService, room);
  }
}

function registerCustomRoomEvents(socket, roomService) {
  socket.removeAllListeners("room:updateConfig"); //! do i need it on other modes?
  socket.removeAllListeners("room:switchRole");

  socket.on("room:updateConfig", (payload = {}) => {
    const parsedPayload = ConfigPatchSchema.safeParse(payload);
    if (!parsedPayload.success) {
      emitError(socket, `INVALID_CONFIG:\n${formatConfigError(parsedPayload.error)}`);
      return;
    }

    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;

    const room = roomService.getRoom(roomId);
    if (!room || room.gameConfig.mode !== "custom") return;

    if (customRoomHosts.get(room.id) !== identity.id) {
      emitError(socket, "ONLY_HOST_CAN_EDIT_ROOM");
      return;
    }

    const nextConfig = applyConfigPatch(
      {
        roomConfig: room.roomConfig,
        matchConfig: room.matchConfig,
        gameConfig: room.gameConfig,
      },
      parsedPayload.data,
    );

    room.roomConfig = {
      ...nextConfig.roomConfig,
      roomName: normalizeRoomName(nextConfig.roomConfig.roomName),
    };
    room.matchConfig = nextConfig.matchConfig;
    room.gameConfig = nextConfig.gameConfig;
    clearAutoStartTimer(room);
    broadcastRoomUpdate(roomService, room);
    maybeAutoStart(roomService, room);
  });

  socket.on("room:switchRole", (payload = {}) => {
    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;

    const nextRole = payload?.role;
    const result = switchCustomRoomRole(roomService, roomId, identity.id, nextRole);
    if (!result.ok) {
      emitError(socket, result.reason);
      return;
    }
    socket.data.role = result.role;
  });

}

export default function join(
  socket,
  { roomService, playerService },
  payload = {}, //! delete this param!!!!!!
) {
  const player = playerService.get(socket.data.identity.id);
  if (!player) {
    emitError(socket, "PLAYER_NOT_FOUND");
    return null;
  }

  registerCustomRoomEvents(socket, roomService);

  const joinCode = parseJoinCode(payload);
  if (joinCode) {
    return joinExistingRoom(socket, roomService, player, joinCode);
  }

  return createCustomRoom(socket, roomService, player, payload);
}
