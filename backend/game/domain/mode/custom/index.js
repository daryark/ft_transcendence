import { applyConfigPatch, createConfig } from "../../../config/configBase";
import { ConfigPatchSchema } from "../../../config/config.schema";
import { initGame } from "../../engine/state";
import { isInput } from "../../engine/input";
import { createBag, moveFigure, rotate, collision, clearLines } from "../../engine/logic";
import { createFigure } from "../../engine/figures";

const JOIN_PREFIX = "JOIN:";
const TICK_MS = 1000 / 60;
const MAX_INPUTS_PER_TICK = 30;
const customRoomHosts = new Map();
const customEngines = new Map();

const ROTATION_KICKS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 2, y: 0 },
  { x: -2, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

function emitError(socket, reason) {
  socket.emit("server:error", { reason });
}

function getPlayerName(player) {
  return player?.profile?.nickname ?? String(player?.id ?? "PLAYER");
}

function serializePlayer(player, hostId) {
  return {
    id: player.id,
    username: getPlayerName(player),
    rank: player.profile?.rank,
    isHost: player.id === hostId,
    connected: player.connected,
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
      serializePlayer(player, hostId),
    ),
    spectators: Array.from(room.spectators?.values() ?? []).map((spectator) =>
      serializePlayer(spectator, hostId),
    ),
    config: {
      roomConfig: room.roomConfig,
      matchConfig: room.matchConfig,
      gameConfig: room.gameConfig,
    },
  };
}

function broadcastRoomUpdate(roomService, room) {
  roomService.broadcast(room.id, "room:update", serializeRoom(room));
}

function ensureNextQueue(state) {
  while (state.next.length < 7) {
    state.next.push(...createBag().map((type) => createFigure(type, state.cols)));
  }
}

function resetPiecePosition(piece, cols) {
  return {
    ...piece,
    x: Math.floor((cols - piece.shape[0].length) / 2),
    y: -2,
  };
}

function spawnPiece(state) {
  ensureNextQueue(state);
  const nextPiece = state.next.shift();

  if (!nextPiece) {
    state.gameOver = true;
    return;
  }

  state.current = resetPiecePosition(nextPiece, state.cols);
  state.canHold = true;
  state.gameOver = collision(state.board, { ...state.current, y: 0 });
}

function trySetCurrent(state, piece) {
  if (collision(state.board, piece)) return false;

  state.current = piece;
  return true;
}

function tryMoveCurrent(state, dx, dy) {
  return trySetCurrent(state, moveFigure(state.current, dx, dy));
}

function rotateMatrix(matrix, turns) {
  let rotated = matrix;

  for (let i = 0; i < turns; i += 1) {
    rotated = rotate(rotated);
  }

  return rotated;
}

function tryRotateCurrent(state, turns) {
  const rotated = rotateMatrix(state.current.shape, turns);

  return ROTATION_KICKS.some((kick) =>
    trySetCurrent(state, {
      ...state.current,
      shape: rotated,
      x: state.current.x + kick.x,
      y: state.current.y + kick.y,
    }),
  );
}

function lockCurrent(state) {
  let current = state.current;

  while (!collision(state.board, moveFigure(current, 0, 1))) {
    current = moveFigure(current, 0, 1);
  }

  current.shape.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      if (!cell) return;

      const x = current.x + dx;
      const y = current.y + dy;

      if (y >= 0 && y < state.rows && x >= 0 && x < state.cols) {
        state.board[y][x] = 1;
      }
    });
  });

  const { newBoard, cleared, scoreAdd } = clearLines(state.board);
  state.board = newBoard;
  state.lines += cleared;
  state.score += scoreAdd;
  spawnPiece(state);
}

function hardDrop(state) {
  while (tryMoveCurrent(state, 0, 1)) {
    state.score += 2;
  }

  lockCurrent(state);
  return true;
}

function holdCurrent(state, controls) {
  if (!controls.hold || !state.canHold) return;

  const held = state.hold;
  state.hold = createFigure(state.current.type, state.cols);
  state.canHold = false;

  if (held) {
    state.current = createFigure(held.type, state.cols);
  } else {
    spawnPiece(state);
  }
}

function applyInput(state, input, controls) {
  if (state.gameOver) return false;

  if (input.type === "left") return tryMoveCurrent(state, -1, 0);
  if (input.type === "right") return tryMoveCurrent(state, 1, 0);
  if (input.type === "down") return tryMoveCurrent(state, 0, 1);
  if (input.type === "rotate") return tryRotateCurrent(state, 1);
  if (input.type === "rotateCCW") return tryRotateCurrent(state, 3);
  if (input.type === "rotate180") return tryRotateCurrent(state, 2);
  if (input.type === "drop") return hardDrop(state);
  if (input.type === "hold") return holdCurrent(state, controls);

  return false;
}

function serializeVersusGame(room, engine) {
  const players = {};

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    players[playerId] = {
      id: player.id,
      username: getPlayerName(player),
      rank: player.profile?.rank,
      state: engine.states.get(playerId),
    };
  }

  return {
    roomId: room.id,
    status: room.status,
    config: room.gameConfig,
    players,
    state: engine.states.values().next().value ?? null,
    startedAt: engine.startedAt,
  };
}

function stopCustomEngine(roomId) {
  const engine = customEngines.get(roomId);
  if (!engine) return;

  clearInterval(engine.interval);
  customEngines.delete(roomId);
}

function startCustomVersus(room, roomService) {
  if (room.status === "playing") return;
  if (room.players.size < 2) {
    roomService.broadcast(room.id, "server:error", { reason: "NEED_TWO_PLAYERS" });
    return;
  }

  stopCustomEngine(room.id);
  room.status = "playing";

  const { boardHeight, boardWidth } = room.gameConfig.general;
  const states = new Map();
  const inputs = new Map();
  const gravity = new Map();
  const startedAt = Date.now();

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    const state = initGame(boardHeight, boardWidth);
    state.startedAt = startedAt;
    states.set(playerId, state);
    inputs.set(playerId, []);
    gravity.set(playerId, 0);
  }

  const engine = {
    startedAt,
    states,
    inputs,
    gravity,
    interval: null,
    pushInput(playerId, input) {
      if (room.status !== "playing") return;

      const queue = inputs.get(String(playerId));
      if (queue) queue.push(input);
    },
    stop() {
      stopCustomEngine(room.id);
    },
  };

  engine.interval = setInterval(() => {
    if (room.status !== "playing") return;

    let activePlayers = 0;

    for (const [playerId, state] of states.entries()) {
      if (state.gameOver) continue;
      activePlayers += 1;

      const queue = inputs.get(playerId) ?? [];
      let processed = 0;
      while (queue.length > 0 && processed < MAX_INPUTS_PER_TICK) {
        applyInput(state, queue.shift(), room.gameConfig.controls);
        processed += 1;
      }

      const currentGravity = (gravity.get(playerId) ?? 0) + room.gameConfig.gravity.gravity;
      if (currentGravity >= 1) {
        if (!tryMoveCurrent(state, 0, 1)) {
          lockCurrent(state);
        }
        gravity.set(playerId, currentGravity - 1);
      } else {
        gravity.set(playerId, currentGravity);
      }
    }

    if (activePlayers <= 1) {
      room.status = "ended";
      roomService.broadcast(room.id, "game:end", {
        ...serializeVersusGame(room, engine),
        reason: "game_over",
      });
      stopCustomEngine(room.id);
      return;
    }

    roomService.broadcast(room.id, "game:update", serializeVersusGame(room, engine));
  }, TICK_MS);

  room.state = states.values().next().value ?? null;
  room.engine = engine;
  roomService.broadcast(room.id, "game:start", serializeVersusGame(room, engine));
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

  if (!canJoinAsPlayer(room, player)) {
    if (room.spectators) {
      roomService.addSpectator(room.id, player);
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.role = "spectator";
      socket.emit("room:update", serializeRoom(room));
      broadcastRoomUpdate(roomService, room);
      return roomService.getRoomState(room.id);
    }

    emitError(socket, "ROOM_FULL");
    return null;
  }

  roomService.addPlayer(room.id, player);
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.role = "player";
  socket.emit("room:update", serializeRoom(room));
  broadcastRoomUpdate(roomService, room);
  maybeAutoStart(roomService, room);

  return roomService.getRoomState(room.id);
}

function createCustomRoom(socket, roomService, player, payload) {
  const config = applyConfigPatch(createConfig("custom"), payload);
  const room = roomService.createRoom(config);

  customRoomHosts.set(room.id, player.id);
  roomService.addPlayer(room.id, player);
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.role = "player";
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
  socket.removeAllListeners("room:updateConfig");
  socket.removeAllListeners("room:start");
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
    if (!roomId) return;

    const room = roomService.getRoom(roomId);
    if (!room || room.gameConfig.mode !== "custom") return;

    startCustomVersus(room, roomService);
  });

  socket.on("player:move", (input) => {
    if (!isInput(input)) return;

    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;

    const room = roomService.getRoom(roomId);
    if (!room || room.gameConfig.mode !== "custom") return;

    room.engine?.pushInput?.(identity.id, input);
  });
}

export default function join(
  socket,
  { roomService, playerService },
  payload = {},
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
