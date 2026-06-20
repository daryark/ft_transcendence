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
import { emitRoomSystemMessage } from "../../../services/roomChatService";
import { emitAchievementUnlocked } from "../../../../sockets/realtime";

import type Config from "../../../config/config.types";
import type Room from "../../room";
import type Player from "../../player";
import type { ConfigPatch } from "../../../config/config.schema";
import type { QuickplayModifier } from "../../../config/gameConfig.types";

const quickplayEngines = new Map<string, MultiplayerEngine>();
const quickplayPlayerConfigs = new WeakMap<Room, Map<string, Config["gameConfig"]>>();
const quickplayPlayerAltitudes = new WeakMap<Room, Map<string, QuickplayAltitude>>();

type QuickplayAltitude = {
    bonusMeters: number;
    lastPiecesPlaced: number;
};

const CLIMB_METERS_PER_10_SECONDS = 2.5;
const CLIMB_METERS_PER_SECOND = CLIMB_METERS_PER_10_SECONDS / 10;

function getPlayerName(player: Player) {
    return player.profile?.nickname ?? String(player.id);
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
        const sentLines = getAttackLines(state.update?.linesCleared ?? 0);
        altitude.bonusMeters += sentLines * CLIMB_METERS_PER_SECOND;
        altitude.lastPiecesPlaced = piecesPlaced;
    }
}

function resetQuickplayAltitude(room: Room, playerId: string) {
    getRoomPlayerAltitudes(room).set(playerId, {
        bonusMeters: 0,
        lastPiecesPlaced: 0,
    });
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
        config.gravity.gravity = Math.min(1, config.gravity.gravity * 1.65);
        config.gravity.gravityIncrease *= 1.45;
        config.gravity.gravitMarginTime = Math.max(
            2000,
            Math.floor(config.gravity.gravitMarginTime * 0.6),
        );
    }

    if (modifiers.includes("messier-garbage")) {
        config.garbage.garbageColumnChangeChance = Math.max(
            config.garbage.garbageColumnChangeChance,
            0.82,
        );
    }

    if (modifiers.includes("double-hole")) {
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

function stopQuickplayEngine(roomId: string) {
    const engine = quickplayEngines.get(roomId);
    if (!engine) return;

    engine.stop();
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
                emitAchievementUnlocked(userId, achievements ?? []);
            })
            .catch((error) => {
                console.error("Failed to persist quickplay result", reason, error);
            });
    }
}

function maybeEndQuickplay(room: Room, roomService: RoomService, engine: MultiplayerEngine, reason = "game_over") {
    if (room.status !== "playing") return false;

    const activePlayerIds = getActiveMultiplayerPlayerIds(engine);
    if (activePlayerIds.length > 0) return false;

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
    room.status = "ended";
    room.engine = null;
    quickplayEngines.delete(room.id);
    quickplayPlayerConfigs.delete(room);
    quickplayPlayerAltitudes.delete(room);
    roomService.deleteRoom(room.id);
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
        getPlayerGameConfig: (player) =>
            getRoomPlayerConfigs(room).get(String(player.id)) ?? room.gameConfig,
        serializeGame: (engine) => serializeQuickplayGame(room, engine),
    });

    room.engine = engine as never;
    room.state = getFirstMultiplayerState(engine);
    quickplayEngines.set(room.id, engine);
    emitRoomSystemMessage(roomService, room, "quickplay started");
    roomService.broadcast(room.id, "game:start", serializeQuickplayGame(room, engine));
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
        roomService.addPlayer(activeQuickplayRoom.id, player);
        getRoomPlayerConfigs(activeQuickplayRoom).set(
            String(player.id),
            applyQuickplayModifiers(activeQuickplayRoom.gameConfig, modifiers),
        );
        resetQuickplayAltitude(activeQuickplayRoom, String(player.id));
        (activeQuickplayRoom.engine as unknown as MultiplayerEngine).addPlayer(player, {
            startedAt: Date.now(),
        });
        socket.join(activeQuickplayRoom.id);
        socket.data.roomId = activeQuickplayRoom.id;
        socket.data.role = "player";
        activeQuickplayRoom.state = getFirstMultiplayerState(
            activeQuickplayRoom.engine as unknown as MultiplayerEngine,
        );
        roomService.broadcast(
            activeQuickplayRoom.id,
            "game:start",
            serializeQuickplayGame(
                activeQuickplayRoom,
                activeQuickplayRoom.engine as unknown as MultiplayerEngine,
            ),
        );
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
    }) ?? roomService.createRoom(baseConfig);

    roomService.addPlayer(room.id, player);
    getRoomPlayerConfigs(room).set(
        String(player.id),
        applyQuickplayModifiers(room.gameConfig, modifiers),
    );
    resetQuickplayAltitude(room, String(player.id));
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = "player";

    emitRoomSystemMessage(roomService, room, "joined quickplay", getPlayerName(player));

    if (room.players.size >= 2) {
        startQuickplay(room, roomService);
    } else {
        socket.emit("room:update", {
            roomId: room.id,
            status: room.status,
            players: room.players.size,
            waitingFor: 2,
        });
    }

    return roomService.getRoomState(room.id);
}

export default join;
