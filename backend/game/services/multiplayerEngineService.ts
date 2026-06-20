import type Room from "../domain/room";
import type Player from "../domain/player";
import type RoomService from "./roomService";
import createEngine, { TICK_MS } from "../domain/engine/tetrisEngine";
import { initGame } from "../domain/engine/state";
import { createGarbageService } from "./garbageService.js";

const COUNTDOWN_STEP_MS = 900;
const COUNTDOWN_STEPS = 5;

type PlayerEngine = {
  player: Player;
  room: Room;
  engine: ReturnType<typeof createEngine> | null;
  roomService: Pick<RoomService, "broadcast"> | null;
};

export type MultiplayerEngine = {
  startedAt: number;
  playerEngines: Map<string, PlayerEngine>;
  eliminatedPlayerIds: Set<string>;
  garbageService: ReturnType<typeof createGarbageService>;
  stockLeft: Map<string, number>;
  interval: ReturnType<typeof setInterval> | null;
  addPlayer(player: Player, options?: { startedAt?: number }): void;
  pushInput(playerId: string | number, input: unknown): void;
  stop(): void;
};

type CreateMultiplayerEngineOptions = {
  room: Room;
  roomService: RoomService;
  onMaybeEnd: (engine: MultiplayerEngine, reason?: string) => boolean;
  onStop?: (engine: MultiplayerEngine) => void;
  onPlayerUpdate?: (playerId: string, state: NonNullable<Room["state"]>) => void;
  getPlayerGameConfig?: (player: Player, room: Room) => Room["gameConfig"];
  serializeGame?: (engine: MultiplayerEngine) => unknown;
};

function toEngineGameConfig(gameConfig: Room["gameConfig"]): Room["gameConfig"] {
  return {
    ...gameConfig,
    mode: "solo" as const,
    objective: {
      winCondition: "score" as const,
      scoreToWin: Number.MAX_SAFE_INTEGER,
    },
  } as Room["gameConfig"];
}

function createPlayerEngineRoom(
  room: Room,
  player: Player,
  startedAt: number,
  gameConfig: Room["gameConfig"] = room.gameConfig,
): Room {
  const { boardHeight, boardWidth } = gameConfig.general;
  const round = (room as Room & { roundNumber?: number }).roundNumber ?? 1;
  const state = initGame(boardHeight, boardWidth, round, startedAt, {
    bagSeed: `${room.id}:round:${round}`,
  });

  return {
    id: `${room.id}:${player.id}` as Room["id"],
    status: "playing",
    players: new Map([[player.id, player]]),
    spectators: new Map(),
    state,
    engine: null,
    match: null,
    roomConfig: room.roomConfig,
    matchConfig: room.matchConfig,
    gameConfig: toEngineGameConfig(gameConfig),
  };
}

export function getFirstMultiplayerState(engine: MultiplayerEngine | null | undefined) {
  return engine?.playerEngines.values().next().value?.room.state ?? null;
}

export function getActiveMultiplayerPlayerIds(engine: MultiplayerEngine) {
  const activePlayerIds: string[] = [];

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

export function isActiveMultiplayerPlayer(
  engine: MultiplayerEngine | null | undefined,
  playerId: string | number,
) {
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

export function serializeMultiplayerGame(
  room: Room,
  engine: MultiplayerEngine,
  getPlayerName: (player: Player) => string,
  getPlayerGameConfig?: (player: Player, room: Room) => Room["gameConfig"],
) {
  const players: Record<string, unknown> = {};

  for (const player of room.players.values()) {
    const playerId = String(player.id);
    const playerEngine = engine.playerEngines.get(playerId);
    const state = playerEngine?.room.state ?? null;

    players[playerId] = {
      id: player.id,
      username: getPlayerName(player),
      rank: player.profile?.rank,
      config: getPlayerGameConfig?.(player, room),
      state,
      stockLeft: engine.stockLeft?.get?.(playerId) ?? 0,
      stockTotal: (room.matchConfig?.stock ?? 0) + 1,
      gameOver: Boolean(
        state?.gameOver || engine.eliminatedPlayerIds.has(playerId),
      ),
    };
  }

  const activePlayerIds = getActiveMultiplayerPlayerIds(engine);

  return {
    roomId: room.id,
    status: room.status,
    config: room.gameConfig,
    players,
    state: getFirstMultiplayerState(engine),
    startedAt: engine.startedAt,
    winnerId: activePlayerIds.length === 1 ? activePlayerIds[0] : null,
  };
}

export function createMultiplayerEngine({
  room,
  roomService,
  onMaybeEnd,
  onStop,
  onPlayerUpdate,
  getPlayerGameConfig,
  serializeGame,
}: CreateMultiplayerEngineOptions): MultiplayerEngine {
  const startedAt = Date.now() + COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
  const playerEngines = new Map<string, PlayerEngine>();
  const eliminatedPlayerIds = new Set<string>();
  const lastPiecesPlaced = new Map<string, number>();
  const stockLeft = new Map<string, number>();
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

  const multiplayerEngine: MultiplayerEngine = {
    startedAt,
    playerEngines,
    eliminatedPlayerIds,
    garbageService,
    stockLeft,
    interval: null,
    addPlayer(player, options = {}) {
      addPlayerToEngine(player, options.startedAt ?? Date.now());
    },
    pushInput(playerId, input) {
      if (room.status !== "playing") return;

      const playerEngine = playerEngines.get(String(playerId));
      if (!playerEngine || playerEngine.room.status !== "playing") return;

      playerEngine.engine?.pushInput(input as never);
    },
    stop() {
      if (multiplayerEngine.interval) {
        clearInterval(multiplayerEngine.interval);
        multiplayerEngine.interval = null;
      }

      for (const playerEngine of playerEngines.values()) {
        playerEngine.engine?.stop?.();
        playerEngine.room.status = "ended";
      }

      onStop?.(multiplayerEngine);
    },
  };

  function respawnPlayer(playerId: string, playerEngine: PlayerEngine) {
    const nextRoom = createPlayerEngineRoom(
      room,
      playerEngine.player,
      startedAt,
      getPlayerGameConfig?.(playerEngine.player, room) ?? room.gameConfig,
    );
    const playerRoomService = playerEngine.roomService;

    garbageService.syncState(playerId, nextRoom.state ?? undefined, Date.now());
    lastPiecesPlaced.set(playerId, 0);
    playerEngine.engine?.stop?.();
    const nextEngine = createEngine(nextRoom, playerRoomService as RoomService);
    nextRoom.engine = nextEngine;
    playerEngine.room = nextRoom;
    playerEngine.engine = nextEngine;
  }

  function handlePlayerOut(playerId: string, playerEngine: PlayerEngine, reason = "game_over") {
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
    return onMaybeEnd(multiplayerEngine, reason);
  }

  function addPlayerToEngine(player: Player, playerStartedAt = startedAt) {
    const playerId = String(player.id);
    const previousPlayerEngine = playerEngines.get(playerId);
    previousPlayerEngine?.engine?.stop?.();

    const playerRoom = createPlayerEngineRoom(
      room,
      player,
      playerStartedAt,
      getPlayerGameConfig?.(player, room) ?? room.gameConfig,
    );
    const playerEngine: PlayerEngine = {
      player,
      room: playerRoom,
      engine: null,
      roomService: null,
    };
    garbageService.syncState(playerId, playerRoom.state ?? undefined, playerStartedAt);
    lastPiecesPlaced.set(playerId, playerRoom.state?.piecesPlaced ?? 0);
    stockLeft.set(playerId, room.matchConfig?.stock ?? 0);
    eliminatedPlayerIds.delete(playerId);
    const playerRoomService = {
      broadcast(_roomId: string, event: string, payload: any) {
        if (event === "game:update") {
          const state = payload ?? playerEngine.room.state;
          playerEngine.room.state = state;

          const previousPiecesPlaced = lastPiecesPlaced.get(playerId) ?? 0;
          const nextPiecesPlaced = state?.piecesPlaced ?? previousPiecesPlaced;

          if (nextPiecesPlaced > previousPiecesPlaced) {
            onPlayerUpdate?.(playerId, state);
            garbageService.handlePieceLocked({
              playerId,
              state,
              linesCleared: state?.update?.linesCleared ?? 0,
              activePlayerIds: getActiveMultiplayerPlayerIds(multiplayerEngine),
              stateMap: getStateMap(),
            });
            lastPiecesPlaced.set(playerId, nextPiecesPlaced);

            if (state?.gameOver && handlePlayerOut(playerId, playerEngine)) {
              return;
            }
            if (onMaybeEnd(multiplayerEngine)) {
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
    playerEngine.engine = createEngine(playerRoom, playerRoomService as RoomService);
    playerRoom.engine = playerEngine.engine;
    playerEngines.set(playerId, playerEngine);
  }

  for (const player of room.players.values()) {
    addPlayerToEngine(player);
  }

  multiplayerEngine.interval = setInterval(() => {
    if (room.status !== "playing") return;

    for (const [playerId, playerEngine] of playerEngines.entries()) {
      if (playerEngine.room.state?.gameOver) {
        if (handlePlayerOut(playerId, playerEngine)) return;
      }
    }

    room.state = getFirstMultiplayerState(multiplayerEngine);
    if (onMaybeEnd(multiplayerEngine)) return;

    roomService.broadcast(
      room.id,
      "game:update",
      serializeGame?.(multiplayerEngine) ??
        serializeMultiplayerGame(room, multiplayerEngine, (player) =>
          player.profile?.nickname ?? String(player.id),
          getPlayerGameConfig,
        ),
    );
  }, TICK_MS);

  return multiplayerEngine;
}
