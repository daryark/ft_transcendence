import { Socket } from "socket.io";
import { applyConfigPatch, createConfig } from "../../../config/configBase";
import RoomService, { RoomServiceRoomState } from "../../../services/roomService";
import PlayerService from "../../../services/playerService";
import {
    createMultiplayerEngine,
    getActiveMultiplayerPlayerIds,
    getFirstMultiplayerState,
    serializeMultiplayerGame,
    type MultiplayerEngine,
} from "../../../services/multiplayerEngineService";
import {
    emitRoomSystemMessage,
    getRoomMessages,
} from "../../../services/roomChatService";
import {
    applyXpToLevel,
    calculateXpDelta,
} from "../../../services/playerProgression";

import type Config from "../../../config/config.types";
import type Room from "../../room";
import type Player from "../../player";
import type { ConfigPatch } from "../../../config/config.schema";
import type { QuickplayModifier } from "../../../config/gameConfig.types";

const quickplayEngines = new Map<string, MultiplayerEngine>();
const quickplayPlayerConfigs = new WeakMap<Room, Map<string, Config["gameConfig"]>>();
const quickplayPlayerAltitudes = new WeakMap<Room, Map<string, QuickplayAltitude>>();
const quickplayLastPlayerTimers = new WeakMap<
    Room,
    { playerId: string; timeout: ReturnType<typeof setTimeout> }
>();
const quickplayPersistedPlayers = new WeakMap<Room, Set<string>>();

type QuickplayAltitude = {
    bonusMeters: number;
    lastPiecesPlaced: number;
};

const CLIMB_METERS_PER_10_SECONDS = 6.7;
const CLIMB_METERS_PER_SECOND = CLIMB_METERS_PER_10_SECONDS / 10;
const LINE_CLEAR_ALTITUDE_SECONDS = 1.4;
const ATTACK_ALTITUDE_SECONDS = 1;
const LAST_PLAYER_END_DELAY_MS = 60_000;

function moveQuickplayPlayerToLobby(room: Room, playerId: string) {
    const player = room.players.get(playerId as never);
    if (!player) return;

    room.players.delete(playerId as never);
    player.role = "spectator";
    player.roomId = room.id;
    room.spectators?.set(player.id, player);
}

function getPlayerName(player: Player) {
    return player.profile?.nickname ?? String(player.id);
}

function notifyAchievementUnlocks(userId: number, achievements: unknown[]) {
    if (achievements.length === 0) return;

    void import("../../../../notifications/service.js")
        .then(({ notifyAchievementUnlocks: notify }) =>
            notify(userId, achievements as never),
        )
        .catch((error) => {
            console.error("Failed to notify quickplay achievements", error);
        });
}

function getRegisteredUserId(player: Player | undefined) {
    if (!player || player.identityType === "anonymous") return null;

    const userId = Number(player.id);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function getBestQuickplayMeters(userId: number) {
    const { prisma } = await import("../../../../prisma/prisma.js");
    const best = await (prisma.match_players as any).findFirst({
        where: {
            user_id: userId,
            matches: {
                gamemode: "quickPlay",
            },
            metric_value: {
                not: null,
            },
        },
        orderBy: {
            metric_value: "desc",
        },
        select: {
            metric_value: true,
        },
    });

    return typeof best?.metric_value === "number" ? best.metric_value : null;
}

function getAttackLines(linesCleared: number) {
    if (linesCleared <= 1) return 0;
    if (linesCleared === 2) return 1;
    if (linesCleared === 3) return 2;
    return 4;
}

function getRoomPlayerAltitudes(room: Room) {
    let altitudes = quickplayPlayerAltitudes.get(room);
    if (!altitudes) {
        altitudes = new Map();
        quickplayPlayerAltitudes.set(room, altitudes);
    }

    return altitudes;
}

function getPlayerAltitude(room: Room, playerId: string) {
    const altitudes = getRoomPlayerAltitudes(room);
    const altitude = altitudes.get(playerId) ?? { bonusMeters: 0, lastPiecesPlaced: 0 };

    altitudes.set(playerId, altitude);
    return altitude;
}

function updateQuickplayAltitude(room: Room, playerId: string, state: Room["state"]) {
    if (!state) return;

    const altitude = getPlayerAltitude(room, playerId);
    const piecesPlaced = state.piecesPlaced ?? 0;

    if (piecesPlaced > altitude.lastPiecesPlaced) {
        const linesCleared = Math.max(0, state.update?.linesCleared ?? 0);
        const sentLines = getAttackLines(linesCleared);
        altitude.bonusMeters +=
            (linesCleared * LINE_CLEAR_ALTITUDE_SECONDS + sentLines * ATTACK_ALTITUDE_SECONDS) *
            CLIMB_METERS_PER_SECOND;
        altitude.lastPiecesPlaced = piecesPlaced;
    }
}

function resetQuickplayAltitude(room: Room, playerId: string) {
    getRoomPlayerAltitudes(room).set(playerId, {
        bonusMeters: 0,
        lastPiecesPlaced: 0,
    });
    quickplayPersistedPlayers.get(room)?.delete(playerId);
}

function getQuickplayMeters(room: Room, playerId: string, state: Room["state"]) {
    if (!state) return 0;

    const elapsedMs = Math.max(0, Date.now() - state.startedAt);
    const passiveMeters = (elapsedMs / 10_000) * CLIMB_METERS_PER_10_SECONDS;
    const altitude = getPlayerAltitude(room, playerId);

    return Number((passiveMeters + altitude.bonusMeters).toFixed(1));
}

function applyQuickplayModifiers(
    baseConfig: Config["gameConfig"],
    modifiers: QuickplayModifier[] = [],
): Config["gameConfig"] {
    const config = structuredClone(baseConfig) as Config["gameConfig"];

    if (config.mode !== "quickplay") return config;

    config.modifiers = modifiers;

    if (modifiers.includes("no-hold")) {
        config.controls.hold = false;
    }

    if (modifiers.includes("faster-gravity")) {
        config.gravity.gravity = Math.min(1, config.gravity.gravity * 1.8);
        config.gravity.gravityIncrease *= 3;
        config.gravity.gravitMarginTime = Math.max(
            1500,
            Math.floor(config.gravity.gravitMarginTime * 0.45),
        );
    }

    if (modifiers.includes("messier-garbage")) {
        config.garbage.garbageColumnChangeChance = 0.82;
    }

    if (modifiers.includes("double-hole")) {
        config.garbage.garbageHoles = 2;
        config.garbage.garbageCap = Math.min(
            config.garbage.garbageMaxCap,
            config.garbage.garbageCap + 2,
        );
    }

    return config;
}

function getRoomPlayerConfigs(room: Room) {
    let configs = quickplayPlayerConfigs.get(room);
    if (!configs) {
        configs = new Map();
        quickplayPlayerConfigs.set(room, configs);
    }

    return configs;
}

function getOrCreateQuickplayRoom(roomService: RoomService) {
    const existingRoom = roomService.findRoom(
        (room) => room.gameConfig.mode === "quickplay",
    );

    if (existingRoom) return existingRoom as Room;

    return roomService.createRoom(createConfig("quickplay")) as Room;
}

function serializeQuickplayGame(room: Room, engine: MultiplayerEngine) {
    const payload = {
        ...serializeMultiplayerGame(
            room,
            engine,
            getPlayerName,
            (player) => getRoomPlayerConfigs(room).get(String(player.id)) ?? room.gameConfig,
        ),
        mode: "quickplay",
    };

    for (const [playerId, player] of Object.entries(payload.players)) {
        const playerState = (player as { state?: Room["state"] }).state ?? null;
        updateQuickplayAltitude(room, playerId, playerState);
        (player as { quickplayMeters?: number; altitudeBonusMeters?: number }).quickplayMeters =
            getQuickplayMeters(room, playerId, playerState);
        (player as { altitudeBonusMeters?: number }).altitudeBonusMeters =
            Number(getPlayerAltitude(room, playerId).bonusMeters.toFixed(1));
    }

    return payload;
}

function serializeQuickplayLobby(room: Room, engine?: MultiplayerEngine | null) {
    const players = engine && room.status === "playing"
        ? Object.values(serializeQuickplayGame(room, engine).players)
        : Array.from(room.players.values()).map((player) => ({
            id: player.id,
            username: getPlayerName(player),
            quickplayMeters: 0,
            gameOver: false,
        }));

    return {
        roomId: room.id,
        status: room.status,
        players: players
            .filter((player) => !(player as { gameOver?: boolean }).gameOver)
            .sort(
                (a, b) =>
                    ((b as { quickplayMeters?: number }).quickplayMeters ?? 0) -
                    ((a as { quickplayMeters?: number }).quickplayMeters ?? 0),
            ),
        playerCount: room.players.size,
        spectatorCount: room.spectators?.size ?? 0,
        chatMessages: getRoomMessages(room),
    };
}

function broadcastQuickplayLobby(roomService: RoomService, room: Room) {
    roomService.broadcast(
        room.id,
        "quickplay:lobby",
        serializeQuickplayLobby(room, room.engine as unknown as MultiplayerEngine | null),
    );
}

function stopQuickplayEngine(roomId: string) {
    const engine = quickplayEngines.get(roomId);
    if (!engine) return;

    engine.stop();
}

function clearLastPlayerTimer(room: Room) {
    const timer = quickplayLastPlayerTimers.get(room);
    if (!timer) return;

    clearTimeout(timer.timeout);
    quickplayLastPlayerTimers.delete(room);
}

function getPersistedQuickplayPlayers(room: Room) {
    let persistedPlayers = quickplayPersistedPlayers.get(room);
    if (!persistedPlayers) {
        persistedPlayers = new Set();
        quickplayPersistedPlayers.set(room, persistedPlayers);
    }

    return persistedPlayers;
}

function buildQuickplayPlayerResult(
    room: Room,
    engine: MultiplayerEngine,
    playerId: string,
    reason = "game_over",
    best?: {
        previousBestMeters: number | null;
        isPersonalBest: boolean;
    },
) {
    const playerEngine = engine.playerEngines.get(playerId);
    const state = playerEngine?.room?.state ?? null;
    const meters = getQuickplayMeters(room, playerId, state);
    const floor = getQuickplayFloor(meters);

    return {
        roomId: room.id,
        playerId,
        reason,
        quickplay: {
            meters,
            floor: floor.index,
            floorName: floor.name,
            previousBestMeters: best?.previousBestMeters ?? null,
            isPersonalBest: best?.isPersonalBest ?? false,
        },
        stats: state?.update ?? null,
    };
}

const QUICKPLAY_FLOORS = [
    { name: "Hall of Beginnings", min: 0 },
    { name: "The Hotel", min: 50 },
    { name: "The Casino", min: 150 },
    { name: "The Arena", min: 300 },
    { name: "The Museum", min: 450 },
    { name: "Abandoned Offices", min: 650 },
    { name: "The Laboratory", min: 850 },
    { name: "The Core", min: 1100 },
    { name: "Corruption", min: 1350 },
    { name: "Platform of the Gods", min: 1650 },
];

function getQuickplayFloor(meters: number) {
    const floorIndex = QUICKPLAY_FLOORS.reduce(
        (current, floor, index) => (meters >= floor.min ? index : current),
        0,
    );

    return {
        ...QUICKPLAY_FLOORS[floorIndex],
        index: floorIndex + 1,
    };
}

function emitQuickplayPlayerResult(
    room: Room,
    roomService: RoomService,
    engine: MultiplayerEngine,
    playerId: string,
    reason = "game_over",
) {
    const player = room.players.get(playerId as never);
    const userId = getRegisteredUserId(player);
    const immediatePayload = buildQuickplayPlayerResult(room, engine, playerId, reason);

    roomService.broadcast(room.id, "quickplay:result", immediatePayload);
    roomService.broadcast(room.id, "quickplay:ko", {
        roomId: room.id,
        playerId,
        username: player ? getPlayerName(player) : playerId,
        meters: immediatePayload.quickplay.meters,
    });
    broadcastQuickplayLobby(roomService, room);

    if (!userId) return;

    void getBestQuickplayMeters(userId)
        .then((previousBestMeters) => {
            const meters = immediatePayload.quickplay.meters;
            roomService.broadcast(
                room.id,
                "quickplay:result",
                buildQuickplayPlayerResult(room, engine, playerId, reason, {
                    previousBestMeters,
                    isPersonalBest:
                        previousBestMeters === null || meters > previousBestMeters,
                }),
            );
        })
        .catch((error) => {
            console.error("Failed to load quickplay best result", error);
        });
}

function persistQuickplayPlayerResult(
    room: Room,
    roomService: RoomService,
    engine: MultiplayerEngine,
    playerId: string,
    result: "win" | "lose",
    reason: string,
) {
    const persistedPlayers = getPersistedQuickplayPlayers(room);
    if (persistedPlayers.has(playerId)) return;
    persistedPlayers.add(playerId);

    const player = room.players.get(playerId as never);
    const userId = getRegisteredUserId(player);
    if (!player || !userId) return;

    const playerState = engine.playerEngines.get(playerId)?.room?.state;
    const metricValue = getQuickplayMeters(room, playerId, playerState ?? null);
    const elapsedMs =
        playerState?.update?.elapsedMs ??
        (playerState ? Math.max(0, Date.now() - playerState.startedAt) : 0);
    const xpDelta = calculateXpDelta({
        userId,
        mode: "quickPlay",
        result,
        score: playerState?.score ?? 0,
        metricValue,
        elapsedMs,
        lines: playerState?.lines ?? 0,
        piecesPlaced: playerState?.piecesPlaced ?? 0,
        roundsPlayed: 1,
    });
    const levelResult = applyXpToLevel(
        player.profile?.level ?? 1,
        player.profile?.xp ?? 0,
        xpDelta,
    );
    const leveledUp = levelResult.level > (player.profile?.level ?? 1);

    if (player.profile) {
        player.profile.level = levelResult.level;
        player.profile.xp = levelResult.xp;
    }

    roomService.broadcast(room.id, "quickplay:result", {
        ...buildQuickplayPlayerResult(room, engine, playerId, reason),
        result: {
            progression: [
                {
                    playerId,
                    xpDelta,
                    level: levelResult.level,
                    xp: levelResult.xp,
                    nextLevelXp: levelResult.nextLevelXp,
                    leveledUp,
                },
            ],
        },
    });

    void import("../../../../prisma/playerStats.js")
        .then(async ({ persistGameResult }) => {
            const achievements = await persistGameResult({
                userId,
                mode: "quickPlay",
                score: playerState?.score ?? 0,
                achievementScore: playerState?.score ?? 0,
                metricValue,
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
                progression: {
                    level: levelResult.level,
                    xp: levelResult.xp,
                    nextLevelXp: levelResult.nextLevelXp,
                    won: result === "win",
                },
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
                result,
            });
            notifyAchievementUnlocks(userId, achievements ?? []);
        })
        .catch((error) => {
            persistedPlayers.delete(playerId);
            console.error("Failed to persist quickplay player result", reason, error);
        });
}

function persistQuickplayResult(
    room: Room,
    engine: MultiplayerEngine,
    winnerId: string | null,
    reason: string,
) {
    const elapsedMs = Math.max(
        0,
        ...Array.from(engine.playerEngines.values()).map((playerEngine) => {
            const state = playerEngine.room?.state;
            return (
                state?.update?.elapsedMs ??
                (state?.startedAt ? Math.max(0, Date.now() - state.startedAt) : 0)
            );
        }),
    );

    for (const player of room.players.values()) {
        const userId = Number(player.id);
        if (!Number.isInteger(userId) || userId <= 0 || player.identityType === "anonymous") {
            continue;
        }

        const playerId = String(player.id);
        if (getPersistedQuickplayPlayers(room).has(playerId)) continue;
        const playerState = engine.playerEngines.get(playerId)?.room?.state;
        const isWinner = playerId === String(winnerId);
        const metricValue = getQuickplayMeters(room, playerId, playerState ?? null);

        void import("../../../../prisma/playerStats.js")
            .then(async ({ persistGameResult }) => {
                const achievements = await persistGameResult({
                    userId,
                    mode: "quickPlay",
                    score: playerState?.score ?? 0,
                    achievementScore: playerState?.score ?? 0,
                    metricValue,
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
                    result: isWinner ? "win" : "lose",
                });
                notifyAchievementUnlocks(userId, achievements ?? []);
            })
            .catch((error) => {
                console.error("Failed to persist quickplay result", reason, error);
            });
    }
}

function maybeEndQuickplay(room: Room, roomService: RoomService, engine: MultiplayerEngine, reason = "game_over") {
    if (room.status !== "playing") return false;

    const activePlayerIds = getActiveMultiplayerPlayerIds(engine);
    if (activePlayerIds.length > 1) {
        clearLastPlayerTimer(room);
        return false;
    }

    if (activePlayerIds.length === 1) {
        const playerId = activePlayerIds[0];
        const currentTimer = quickplayLastPlayerTimers.get(room);
        if (currentTimer?.playerId === playerId) return false;

        clearLastPlayerTimer(room);
        roomService.broadcast(room.id, "quickplay:warning", {
            roomId: room.id,
            playerId,
            seconds: LAST_PLAYER_END_DELAY_MS / 1000,
            message:
                "Only one player remains. Quick Play ends in 60 seconds if nobody joins.",
        });
        emitRoomSystemMessage(
            roomService,
            room,
            "only one player remains; quickplay ends in 60 seconds if nobody joins",
        );
        quickplayLastPlayerTimers.set(room, {
            playerId,
            timeout: setTimeout(() => {
                const currentEngine = quickplayEngines.get(room.id);
                if (!currentEngine || room.status !== "playing") return;

                const currentActivePlayerIds = getActiveMultiplayerPlayerIds(currentEngine);
                if (
                    currentActivePlayerIds.length === 1 &&
                    currentActivePlayerIds[0] === playerId
                ) {
                    emitQuickplayPlayerResult(
                        room,
                        roomService,
                        currentEngine,
                        playerId,
                        "game_over",
                    );
                    persistQuickplayPlayerResult(
                        room,
                        roomService,
                        currentEngine,
                        playerId,
                        "lose",
                        "game_over",
                    );
                    moveQuickplayPlayerToLobby(room, playerId);
                    currentEngine.eliminatedPlayerIds.add(playerId);
                    maybeEndQuickplay(room, roomService, currentEngine, "game_over");
                }
            }, LAST_PLAYER_END_DELAY_MS),
        });
        return false;
    }

    clearLastPlayerTimer(room);

    const winnerId = activePlayerIds[0] ?? null;
    const payload = {
        ...serializeQuickplayGame(room, engine),
        reason,
        winnerId,
        result: {
            outcome: winnerId ? "win" : "defeat",
            stats: getFirstMultiplayerState(engine)?.update,
            progression: [],
        },
    };

    persistQuickplayResult(room, engine, winnerId, reason);
    emitRoomSystemMessage(roomService, room, "game ended due to the lack of players");
    roomService.broadcast(room.id, "game:update", payload);
    roomService.broadcast(room.id, "game:end", payload);
    engine.stop();
    room.status = "lobby";
    room.state = null;
    room.engine = null;
    quickplayEngines.delete(room.id);
    quickplayPlayerConfigs.delete(room);
    quickplayPlayerAltitudes.delete(room);
    quickplayPersistedPlayers.delete(room);
    clearLastPlayerTimer(room);
    broadcastQuickplayLobby(roomService, room);
    return true;
}

function startQuickplay(room: Room, roomService: RoomService) {
    if (room.status === "playing" || room.players.size < 2) return;

    stopQuickplayEngine(room.id);
    room.status = "playing";

    const engine = createMultiplayerEngine({
        room,
        roomService,
        onMaybeEnd: (nextEngine, reason) =>
            maybeEndQuickplay(room, roomService, nextEngine, reason),
        onStop: () => quickplayEngines.delete(room.id),
        onPlayerUpdate: (playerId, state) => updateQuickplayAltitude(room, playerId, state),
        onPlayerOut: (playerId, _state, nextEngine, reason) => {
            emitQuickplayPlayerResult(room, roomService, nextEngine, playerId, reason);
            persistQuickplayPlayerResult(room, roomService, nextEngine, playerId, "lose", reason ?? "game_over");
            moveQuickplayPlayerToLobby(room, playerId);
            broadcastQuickplayLobby(roomService, room);
        },
        getPlayerGameConfig: (player) =>
            getRoomPlayerConfigs(room).get(String(player.id)) ?? room.gameConfig,
        serializeGame: (engine) => {
            const payload = serializeQuickplayGame(room, engine);
            roomService.broadcast(room.id, "quickplay:lobby", serializeQuickplayLobby(room, engine));
            return payload;
        },
    });

    room.engine = engine as never;
    room.state = getFirstMultiplayerState(engine);
    quickplayEngines.set(room.id, engine);
    emitRoomSystemMessage(roomService, room, "quickplay started");
    roomService.broadcast(room.id, "game:start", serializeQuickplayGame(room, engine));
    broadcastQuickplayLobby(roomService, room);
}

export function joinQuickplayLobby(
    socket: Socket,
    { roomService, playerService }: { roomService: RoomService; playerService: PlayerService },
) {
    const player = playerService.get(socket.data.identity.id);
    if (!player) return null;

    const room = getOrCreateQuickplayRoom(roomService);
    const isActivePlayer = room.players.has(player.id);

    if (!isActivePlayer) {
        roomService.addSpectator(room.id, player);
    }

    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = isActivePlayer ? "player" : "spectator";
    socket.emit("quickplay:lobby" as never, serializeQuickplayLobby(
        room,
        room.engine as unknown as MultiplayerEngine | null,
    ));

    return roomService.getRoomState(room.id);
}

export function spectateQuickplay(
    socket: Socket,
    { roomService, playerService }: { roomService: RoomService; playerService: PlayerService },
) {
    const player = playerService.get(socket.data.identity.id);
    if (!player) return null;

    const room = getOrCreateQuickplayRoom(roomService);
    if (room.status !== "playing" || !room.engine) {
        socket.emit("server:error" as never, { reason: "QUICKPLAY_NOT_RUNNING" });
        return null;
    }

    if (!room.players.has(player.id)) {
        roomService.addSpectator(room.id, player);
    }

    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = room.players.has(player.id) ? "player" : "spectator";
    socket.emit(
        "game:start" as never,
        serializeQuickplayGame(room, room.engine as unknown as MultiplayerEngine),
    );
    socket.emit("quickplay:lobby" as never, serializeQuickplayLobby(
        room,
        room.engine as unknown as MultiplayerEngine,
    ));

    return roomService.getRoomState(room.id);
}

export function join(
    socket: Socket,
    { roomService, playerService }: { roomService: RoomService; playerService: PlayerService },
    payload: ConfigPatch = {}
): RoomServiceRoomState | null {
    const baseConfig: Config = applyConfigPatch(createConfig("quickplay"), payload);
    const modifiers =
        baseConfig.gameConfig.mode === "quickplay"
            ? baseConfig.gameConfig.modifiers ?? []
            : [];
    const player = playerService.get(socket.data.identity.id);
    if (!player) return null;

    const currentQuickplayRoom = player.roomId
        ? roomService.getRoom(player.roomId as never)
        : undefined;
    const activeQuickplayRoom =
        currentQuickplayRoom?.gameConfig.mode === "quickplay" &&
        currentQuickplayRoom.status === "playing"
            ? currentQuickplayRoom
            : roomService.findRoom((existingRoom) => {
                return (
                    existingRoom.gameConfig.mode === "quickplay" &&
                    existingRoom.status === "playing"
                );
            });

    if (
        activeQuickplayRoom?.gameConfig.mode === "quickplay" &&
        activeQuickplayRoom.status === "playing" &&
        activeQuickplayRoom.engine
    ) {
        const activeEngine = activeQuickplayRoom.engine as unknown as MultiplayerEngine;
        if (
            activeQuickplayRoom.players.has(player.id) &&
            activeEngine.playerEngines.has(String(player.id))
        ) {
            socket.join(activeQuickplayRoom.id);
            socket.data.roomId = activeQuickplayRoom.id;
            socket.data.role = "player";
            socket.emit(
                "game:start" as never,
                serializeQuickplayGame(activeQuickplayRoom, activeEngine),
            );
            socket.emit("quickplay:lobby" as never, serializeQuickplayLobby(
                activeQuickplayRoom,
                activeEngine,
            ));
            return roomService.getRoomState(activeQuickplayRoom.id);
        }

        activeQuickplayRoom.spectators?.delete(player.id);
        roomService.addPlayer(activeQuickplayRoom.id, player);
        getRoomPlayerConfigs(activeQuickplayRoom).set(
            String(player.id),
            applyQuickplayModifiers(activeQuickplayRoom.gameConfig, modifiers),
        );
        resetQuickplayAltitude(activeQuickplayRoom, String(player.id));
        clearLastPlayerTimer(activeQuickplayRoom);
        activeEngine.addPlayer(player, {
            startedAt: Date.now(),
        });
        socket.join(activeQuickplayRoom.id);
        socket.data.roomId = activeQuickplayRoom.id;
        socket.data.role = "player";
        activeQuickplayRoom.state = getFirstMultiplayerState(
            activeEngine,
        );
        roomService.broadcast(
            activeQuickplayRoom.id,
            "game:start",
            serializeQuickplayGame(
                activeQuickplayRoom,
                activeEngine,
            ),
        );
        broadcastQuickplayLobby(roomService, activeQuickplayRoom);
        return roomService.getRoomState(activeQuickplayRoom.id);
    }

    const room: Room = (
        currentQuickplayRoom?.gameConfig.mode === "quickplay" &&
        currentQuickplayRoom.status === "lobby"
            ? currentQuickplayRoom
            : undefined
    ) ?? roomService.findRoom((existingRoom) => {
        return (
            existingRoom.gameConfig.mode === "quickplay" &&
            existingRoom.status === "lobby"
        );
    }) ?? getOrCreateQuickplayRoom(roomService);

    const wasPlayerInRoom = room.players.has(player.id);
    room.spectators?.delete(player.id);
    if (!wasPlayerInRoom) {
        roomService.addPlayer(room.id, player);
    }
    getRoomPlayerConfigs(room).set(
        String(player.id),
        applyQuickplayModifiers(room.gameConfig, modifiers),
    );
    if (!wasPlayerInRoom) {
        resetQuickplayAltitude(room, String(player.id));
    }
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = "player";

    if (!wasPlayerInRoom) {
        emitRoomSystemMessage(roomService, room, "joined quickplay", getPlayerName(player));
    }

    if (room.players.size >= 2) {
        startQuickplay(room, roomService);
    } else {
        socket.emit("room:update", {
            roomId: room.id,
            status: room.status,
            players: room.players.size,
            waitingFor: 2,
            chatMessages: getRoomMessages(room),
        });
        broadcastQuickplayLobby(roomService, room);
    }

    return roomService.getRoomState(room.id);
}

export default join;
