import { applyConfigPatch, createConfig } from "../../../config/configBase";
import { ConfigPatchSchema } from "../../../config/config.schema";
import createEngine, { TICK_MS } from "../../engine/tetrisEngine";
import { initGame } from "../../engine/state";
import { isInput } from "../../engine/input";
import { emitAchievementUnlocked } from "../../../../sockets/realtime";

const JOIN_PREFIX = "JOIN:";
const customRoomHosts = new Map();
const customEngines = new Map();
const customRoomScores = new Map();
const customRoomMessages = new Map();
const MAX_ROOM_MESSAGES = 100;

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
    players: Array.from(room.players.values()).map((player) =>
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

  if (!room.roomConfig.public) {
    return players[0]?.id ?? null;
  }

  return players.find(isRegisteredPlayer)?.id ?? null;
}

function ensureRoomHost(room) {
  const currentHostId = customRoomHosts.get(room.id);
  const currentHost = currentHostId ? room.players.get(currentHostId) : null;

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
  const state = initGame(boardHeight, boardWidth);
  state.startedAt = startedAt;

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

  for (const playerId of engine.playerEngines.keys()) {
    getPlayerRoomStats(room, playerId).games += 1;
  }

  if (winnerId) {
    getPlayerRoomStats(room, winnerId).wins += 1;
  }

  for (const [playerId, playerEngine] of engine.playerEngines.entries()) {
    const player = playerEngine.player;
    const userId = Number(playerId);
    const state = playerEngine.room.state;

    if (
      player?.identityType !== "registered" ||
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !state
    ) {
      continue;
    }

    void import("../../../../prisma/playerStats.js")
      .then(async ({ persistGameResult }) => {
        const achievements = await persistGameResult({
          userId,
          mode: "customGame",
          score: state.score,
          result: winnerId === playerId ? "win" : "lose",
          stats: {
            lines: state.lines,
            piecesPlaced: state.piecesPlaced,
            hardDrops: state.hardDrops,
            holds: state.holds,
            maxCombo: state.maxCombo,
            maxLinesCleared: state.maxLinesCleared,
            clearedTwoAtOnce: state.clearedTwoAtOnce,
            clearedThreeAtOnce: state.clearedThreeAtOnce,
            tetrises: state.tetrises,
            durationMs: Math.max(0, Date.now() - state.startedAt),
            clearedAfterHalfHeight: state.clearedAfterHalfHeight,
          },
        });
        emitAchievementUnlocked(userId, achievements ?? []);
      })
      .catch((error) => {
        console.error("Failed to persist custom game result", error);
      });
  }

  room.status = "ended";
  room.state = getFirstPlayerState(engine);

  const payload = {
    ...serializeVersusGame(room, engine),
    reason,
    winnerId,
  };

  emitSystemMessage(roomService, room, "game finished");
  roomService.broadcast(room.id, "game:update", payload);
  roomService.broadcast(room.id, "game:end", payload);
  engine.stop();
  room.status = "lobby";
  room.engine = null;
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

  if (role === "player") {
    const leavingPlayer = room.players.get(playerId);
    if (!leavingPlayer) return false;

    const leavingPlayerName = getPlayerName(leavingPlayer);
    const playerEngine = engine?.playerEngines?.get?.(normalizedPlayerId);
    playerEngine?.engine?.stop?.();
    if (playerEngine?.room) {
      playerEngine.room.status = "ended";
    }
    engine?.eliminatedPlayerIds?.add?.(normalizedPlayerId);
    roomService.removePlayer(roomId, playerId);

    if (room.players.size === 0) {
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

  roomService.removeSpectator(roomId, playerId);
  emitSystemMessage(roomService, room, "left the room", getPlayerName(spectator));
  broadcastRoomUpdate(roomService, room);
  return true;
}

function createVersusEngine(room, roomService) {
  const startedAt = Date.now();
  const playerEngines = new Map();
  const eliminatedPlayerIds = new Set();

  const versusEngine = {
    startedAt,
    playerEngines,
    eliminatedPlayerIds,
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

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    const playerRoom = createPlayerEngineRoom(room, player, startedAt);
    const playerRoomService = {
      broadcast(_roomId, event, payload) {
        if (event === "game:end") {
          eliminatedPlayerIds.add(playerId);
          playerRoom.status = "ended";
          playerRoom.state = payload?.state ?? playerRoom.state;
          maybeEndVersus(room, roomService, versusEngine, payload?.reason);
        }
      },
    };

    const playerEngine = createEngine(playerRoom, playerRoomService);
    playerRoom.engine = playerEngine;
    playerEngines.set(playerId, {
      player,
      room: playerRoom,
      engine: playerEngine,
    });
  }

  versusEngine.interval = setInterval(() => {
    if (room.status !== "playing") return;

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
  if (room.players.size < 2) {
    roomService.broadcast(room.id, "server:error", {
      reason: "NEED_TWO_PLAYERS",
    });
    return;
  }

  stopCustomEngine(room.id);
  room.status = "playing";

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
  if (room.status !== "lobby") {
    return false;
  }

  if (room.players.has(player.id)) {
    return true;
  }

  return room.players.size < getMaxPlayers(room);
}

function joinExistingRoom(socket, roomService, player, roomCode) {
  const room = roomService.getRoom(roomCode);

  if (!room || room.gameConfig.mode !== "custom") {
    emitError(socket, "ROOM_NOT_FOUND");
    return null;
  }

  const wasAlreadyPlayer = room.players.has(player.id);
  const wasAlreadySpectator = room.spectators?.has(player.id) ?? false;

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

  roomService.addPlayer(room.id, player);
  ensureRoomHost(room);
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.role = "player";
  if (!wasAlreadyPlayer) {
    emitSystemMessage(roomService, room, "joined the room", getPlayerName(player));
  }
  socket.emit("room:update", serializeRoom(room));
  if (!wasAlreadyPlayer) {
    broadcastRoomUpdate(roomService, room);
    maybeAutoStart(roomService, room);
  }

  return roomService.getRoomState(room.id);
}

function createCustomRoom(socket, roomService, player, payload) {
  const config = applyConfigPatch(createConfig("custom"), payload);
  const room = roomService.createRoom(config);

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

    if (room.status !== "lobby") {
      emitError(socket, "ROOM_ALREADY_STARTED");
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
