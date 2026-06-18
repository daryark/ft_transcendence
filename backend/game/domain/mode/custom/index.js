import { applyConfigPatch, createConfig } from "../../../config/configBase";
import { ConfigPatchSchema } from "../../../config/config.schema";
import createEngine, { TICK_MS } from "../../engine/tetrisEngine";
import { initGame } from "../../engine/state";
import { isInput } from "../../engine/input";
import { createGarbageService } from "../../../services/garbageService.js";

const JOIN_PREFIX = "JOIN:";
const customRoomHosts = new Map();
const customEngines = new Map();
const customRoomScores = new Map();
const customRoomMessages = new Map();
const MAX_ROOM_MESSAGES = 100;
const COUNTDOWN_STEP_MS = 900;
const COUNTDOWN_STEPS = 5;

function emitError(socket, reason) {
  socket.emit("server:error", { reason });
}

function getPlayerName(player) {
  return player?.profile?.nickname ?? String(player?.id ?? "PLAYER");
}

function getRoomMessages(room) {
  if (!customRoomMessages.has(room.id)) {
    customRoomMessages.set(room.id, []);
  }

  return customRoomMessages.get(room.id);
}

export function appendCustomRoomChatMessage(room, message) {
  if (!room || room.gameConfig.mode !== "custom") return message;

  const messages = getRoomMessages(room);
  const storedMessage = {
    id: `${Date.now()}-${messages.length}`,
    ...message,
  };

  messages.push(storedMessage);
  if (messages.length > MAX_ROOM_MESSAGES) {
    messages.splice(0, messages.length - MAX_ROOM_MESSAGES);
  }

  return storedMessage;
}

function emitSystemMessage(roomService, room, message, actor) {
  const payload = appendCustomRoomChatMessage(room, {
    sender: "SYS",
    system: true,
    actor: actor ? String(actor).toUpperCase() : undefined,
    message,
  });

  roomService.broadcast(room.id, "chat:message", payload);
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
    rank: player.profile?.rank,
    role: player.role,
    isHost: player.id === hostId,
    connected: player.connected,
    matchWins: stats.wins,
    matchTotalGames: stats.games,
  };
}

function serializeRoom(room) {
  const hostId = customRoomHosts.get(room.id);

  return {
    roomId: room.id,
    roomCode: room.id,
    roomName: room.roomConfig.roomName,
    visibility: room.roomConfig.public ? "public" : "private",
    status: room.status,
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
  const roomHasPlayers =
    room.players.size + getWaitingPlayers(room).size > 0;
  const currentHostIsSpectator = Boolean(
    currentHostId && room.spectators?.has(currentHostId),
  );

  if (
    currentHost &&
    (!room.roomConfig.public ||
      (isRegisteredPlayer(currentHost) &&
        (!currentHostIsSpectator || roomHasPlayers)))
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

function toEngineGameConfig(gameConfig) {
  return {
    ...gameConfig,
    mode: "solo",
    objective: {
      winCondition: "score",
      scoreToWin: Number.MAX_SAFE_INTEGER,
    },
  };
}

function createPlayerEngineRoom(room, player, startedAt) {
  const { boardHeight, boardWidth } = room.gameConfig.general;
  const round = room.roundNumber ?? 1;
  const state = initGame(boardHeight, boardWidth, round, startedAt, {
    bagSeed: `${room.id}:round:${round}`,
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
    gameConfig: toEngineGameConfig(room.gameConfig),
  };
}

function calculateCustomXpDelta(elapsedMs, isWinner) {
  const survivedSeconds = Math.max(0, elapsedMs / 1000);
  const winnerXp = Math.min(500, 220 + survivedSeconds * 2.4);

  return Math.round(isWinner ? winnerXp : Math.max(0, winnerXp - 100));
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

function isActiveVersusPlayer(engine, playerId) {
  if (!engine?.playerEngines?.has?.(String(playerId))) return false;

  const playerEngine = engine.playerEngines.get(String(playerId));
  const state = playerEngine?.room.state;

  return Boolean(
    playerEngine?.room.status === "playing" &&
      state &&
      !state.gameOver &&
      !engine.eliminatedPlayerIds?.has?.(String(playerId)),
  );
}

function serializeVersusGame(room, engine) {
  const players = {};

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    const playerEngine = engine.playerEngines.get(playerId);
    const state = playerEngine?.room.state ?? null;

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
    state: getFirstPlayerState(engine),
    startedAt: engine.startedAt,
    winnerId: activePlayerIds.length === 1 ? activePlayerIds[0] : null,
  };
}

function stopCustomEngine(roomId) {
  const engine = customEngines.get(roomId);
  if (!engine) return;

  engine.stop();
}

function maybeEndVersus(room, roomService, engine, reason = "game_over") {
  if (room.status !== "playing") return false;

  const activePlayerIds = getActivePlayerIds(engine);
  if (activePlayerIds.length > 1) return false;
  const winnerId = activePlayerIds[0] ?? null;
  const roundsToWin = room.matchConfig?.roundsToWin ?? 1;
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

  if (
    winnerId &&
    room.players.size > 1 &&
    (roundWins.get(String(winnerId)) ?? 0) < roundsToWin
  ) {
    const payload = {
      ...serializeVersusGame(room, engine),
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
      const nextEngine = createVersusEngine(room, roomService);
      room.engine = nextEngine;
      room.state = getFirstPlayerState(nextEngine);
      customEngines.set(room.id, nextEngine);
      roomService.broadcast(room.id, "game:start", serializeVersusGame(room, nextEngine));
    }, 2400);
    return true;
  }

  room.status = "ended";
  room.state = getFirstPlayerState(engine);
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
    ...serializeVersusGame(room, engine),
    reason,
    winnerId,
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
      rankXpDelta: 0,
      level: player.profile?.level ?? 1,
      xp: player.profile?.xp ?? 0,
    });

    void import("../../../../prisma/playerStats.js")
      .then(({ persistGameResult }) =>
        persistGameResult({
          userId,
          mode: "customGame",
          score: playerState?.score ?? 0,
          elapsedMs: sharedElapsedMs,
          lines: playerState?.lines ?? 0,
          piecesPlaced: playerState?.piecesPlaced ?? 0,
          roundsPlayed: round,
          result: isWinner ? "win" : "lose",
        }),
      )
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
      customRoomMessages.delete(room.id);
      stopCustomEngine(room.id);
      roomService.deleteRoom(room.id);
      return true;
    }

    ensureRoomHost(room);
    emitSystemMessage(roomService, room, "left the room", leavingPlayerName);

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

function createVersusEngine(room, roomService) {
  const startedAt = Date.now() + COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
  const playerEngines = new Map();
  const eliminatedPlayerIds = new Set();
  const lastPiecesPlaced = new Map();
  const stockLeft = new Map();
  const garbageService = createGarbageService(room.gameConfig.garbage);

  function getStateMap() {
    const states = new Map();

    for (const [playerId, playerEngine] of playerEngines.entries()) {
      if (playerEngine.room.state) {
        states.set(playerId, playerEngine.room.state);
      }
    }

    return states;
  }

  const versusEngine = {
    startedAt,
    playerEngines,
    eliminatedPlayerIds,
    garbageService,
    stockLeft,
    interval: null,
    pushInput(playerId, input) {
      if (room.status !== "playing") return;

      const playerEngine = playerEngines.get(String(playerId));
      if (!playerEngine || playerEngine.room.status !== "playing") return;

      playerEngine.engine.pushInput(input);
    },
    stop() {
      if (versusEngine.interval) {
        clearInterval(versusEngine.interval);
        versusEngine.interval = null;
      }

      for (const playerEngine of playerEngines.values()) {
        playerEngine.engine?.stop?.();
        playerEngine.room.status = "ended";
      }

      customEngines.delete(room.id);
    },
  };

  function respawnPlayer(playerId, playerEngine) {
    const nextRoom = createPlayerEngineRoom(room, playerEngine.player, startedAt);
    const playerRoomService = playerEngine.roomService;

    garbageService.syncState(playerId, nextRoom.state, Date.now());
    lastPiecesPlaced.set(playerId, 0);
    playerEngine.engine?.stop?.();
    const nextEngine = createEngine(nextRoom, playerRoomService);
    nextRoom.engine = nextEngine;
    playerEngine.room = nextRoom;
    playerEngine.engine = nextEngine;
  }

  function handlePlayerOut(playerId, playerEngine, reason = "game_over") {
    if (eliminatedPlayerIds.has(playerId)) return false;

    const remainingStock = stockLeft.get(playerId) ?? 0;
    if (remainingStock > 0) {
      stockLeft.set(playerId, remainingStock - 1);
      respawnPlayer(playerId, playerEngine);
      return false;
    }

    eliminatedPlayerIds.add(playerId);
    playerEngine.engine?.stop?.();
    playerEngine.room.status = "ended";
    return maybeEndVersus(room, roomService, versusEngine, reason);
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
    stockLeft.set(playerId, room.matchConfig?.stock ?? 0);
    const playerRoomService = {
      broadcast(_roomId, event, payload) {
        if (event === "game:update") {
          const state = payload ?? playerEngine.room.state;
          playerEngine.room.state = state;

          const previousPiecesPlaced = lastPiecesPlaced.get(playerId) ?? 0;
          const nextPiecesPlaced = state?.piecesPlaced ?? previousPiecesPlaced;

          if (nextPiecesPlaced > previousPiecesPlaced) {
            garbageService.handlePieceLocked({
              playerId,
              state,
              linesCleared: state?.update?.linesCleared ?? 0,
              activePlayerIds: getActivePlayerIds(versusEngine),
              stateMap: getStateMap(),
            });
            lastPiecesPlaced.set(playerId, nextPiecesPlaced);

            if (state?.gameOver && handlePlayerOut(playerId, playerEngine)) {
              return;
            }
            if (maybeEndVersus(room, roomService, versusEngine)) {
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

  versusEngine.interval = setInterval(() => {
    if (room.status !== "playing") return;

    for (const [playerId, playerEngine] of playerEngines.entries()) {
      if (playerEngine.room.state?.gameOver) {
        if (handlePlayerOut(playerId, playerEngine)) return;
      }
    }

    room.state = getFirstPlayerState(versusEngine);
    if (maybeEndVersus(room, roomService, versusEngine)) return;

    roomService.broadcast(
      room.id,
      "game:update",
      serializeVersusGame(room, versusEngine),
    );
  }, TICK_MS);

  return versusEngine;
}

function startCustomVersus(room, roomService) {
  if (room.status === "playing") return;
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

  const engine = createVersusEngine(room, roomService);
  room.engine = engine;
  room.state = getFirstPlayerState(engine);
  customEngines.set(room.id, engine);

  emitSystemMessage(roomService, room, "game started");
  roomService.broadcast(
    room.id,
    "game:start",
    serializeVersusGame(room, engine),
  );
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
      isActiveVersusPlayer(room.engine, playerId)
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
    room.status === "lobby" &&
    typeof autoStart === "number" &&
    autoStart > 0 &&
    room.players.size >= autoStart
  ) {
    startCustomVersus(room, roomService);
  }
}

function registerCustomRoomEvents(socket, roomService) {
  socket.removeAllListeners("room:updateConfig"); //! do i need it on other modes?
  socket.removeAllListeners("room:start"); //! is it native socket.io fn?
  socket.removeAllListeners("room:switchRole");
  socket.removeAllListeners("player:move");

  socket.on("room:updateConfig", (payload = {}) => {
    const parsedPayload = ConfigPatchSchema.safeParse(payload);
    if (!parsedPayload.success) {
      emitError(socket, "INVALID_CONFIG");
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

    room.roomConfig = nextConfig.roomConfig;
    room.matchConfig = nextConfig.matchConfig;
    room.gameConfig = nextConfig.gameConfig;
    broadcastRoomUpdate(roomService, room);
    maybeAutoStart(roomService, room);
  });

  socket.on("room:start", () => {
    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;

    const room = roomService.getRoom(roomId);
    if (!room || room.gameConfig.mode !== "custom") return;

    if (customRoomHosts.get(room.id) !== identity.id) {
      emitError(socket, "ONLY_HOST_CAN_START_ROOM");
      return;
    }

    startCustomVersus(room, roomService);
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

  socket.on("player:move", (input) => {
    if (!isInput(input)) return;

    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity || socket.data.role !== "player") return;

    const room = roomService.getRoom(roomId);
    if (!room || room.gameConfig.mode !== "custom") return;

    room.engine?.pushInput?.(identity.id, input);
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
