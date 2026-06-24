import { Socket } from "socket.io";
import { SocketData } from ".";
import { isInput } from "../game/domain/engine/input";
import { ModeService } from "../game/services/modeService";
import PlayerService from "../game/services/playerService";
import { GameMode } from "../game/config/gameConfig.types";
import RoomService from "../game/services/roomService";
import { ConfigPatch, ConfigPatchSchema } from "../game/config/config.schema";
import startGame from "../game/domain/match/startGame";
import { leaveSocketRoomNow } from "./roomSocketExit";
import { interruptGameSession } from "../game/services/gameInterruptService";
import { startCustomRoom } from "../game/domain/mode/custom";
import { joinQuickplayLobby, spectateQuickplay } from "../game/domain/mode/quickplay";

export type ClientToServerEvents =
    | "mode:join"
    | "mode:leave"
    | "rooms:list"
    | "room:start"
    | "room:switchRole"
    | "player:move"
    | "game:resume"
    | "game:stop"
    | "quickplay:lobby"
    | "quickplay:spectate";

export type ServerToClientEvents =
    | "session:identity"
    | "game:start"
    | "game:update"
    | "game:resume"
    | "game:end"
    | "round:start"
    | "round:end"
    | "quickplay:result"
    | "quickplay:ko"
    | "quickplay:warning"
    | "quickplay:lobby"
    | "room:update"
    | "rooms:update"
    | "social:update"
    | "notifications"
    | "server:error";

export function emitError(socket: Socket, reason: string) {
    socket.emit("server:error" as ServerToClientEvents, { reason });
}

function serializeResumePayload(room: NonNullable<ReturnType<RoomService["getRoom"]>>) {
    const customEngine = room.engine as any;
    const versusPlayers: Record<string, unknown> = {};

    if (customEngine?.playerEngines instanceof Map) {
        for (const player of room.players.values()) {
            const playerId = String(player.id);
            const playerEngine = customEngine.playerEngines.get(playerId);
            const state = playerEngine?.room?.state ?? null;

            versusPlayers[playerId] = {
                id: player.id,
                username: player.profile?.nickname ?? `Player ${playerId.slice(0, 5)}`,
                state,
                gameOver: Boolean(
                    state?.gameOver ||
                    customEngine.eliminatedPlayerIds?.has?.(playerId),
                ),
            };
        }
    }

    return {
        roomId: room.id,
        status: room.status,
        state: room.state,
        config: room.gameConfig,
        ...(Object.keys(versusPlayers).length > 0
            ? { players: versusPlayers }
            : {}),
    };
}

export default function gameHandlers(
    socket: Socket,
    { modeService, roomService, playerService }:
        { modeService: ModeService; roomService: RoomService; playerService: PlayerService }) {

    socket.on("mode:join", ({ mode, payload = {} }:
        { mode: GameMode; payload?: ConfigPatch }) => {

        const parsedPayload = ConfigPatchSchema.safeParse(payload);
        if (!parsedPayload.success) {
            emitError(socket, "INVALID_CONFIG");
            return;
        }
        modeService.join(mode, socket, parsedPayload.data);
    });

    socket.on("rooms:list", () => {
        socket.emit("rooms:update" as ServerToClientEvents, roomService.listPublicCustomRooms());
    });

    socket.on("quickplay:lobby" as ClientToServerEvents, () => {
        joinQuickplayLobby(socket, { roomService, playerService });
    });

    socket.on("quickplay:spectate" as ClientToServerEvents, () => {
        spectateQuickplay(socket, { roomService, playerService });
    });

    socket.on("player:move", (input: unknown) => {
        if (!isInput(input)) return;

        const { identity, roomId, role } = socket.data as SocketData;
        if (roomId && role === "player") {
            const room = roomService.getRoom(roomId);
            if (
                (room?.gameConfig?.mode === "custom" ||
                    room?.gameConfig?.mode === "quickplay") &&
                identity
            ) {
                (room.engine as { pushInput?: (playerId: string, input: unknown) => void } | null)
                    ?.pushInput?.(String(identity.id), input);
                return;
            }

            room?.engine?.pushInput(input);
        }
    });

    socket.on("game:resume", () => {
        const { roomId } = socket.data as SocketData;
        if (!roomId) {
            emitError(socket, "NO_ACTIVE_GAME");
            return;
        }

        const room = roomService.getRoom(roomId);
        if (!room) {
            emitError(socket, "ROOM_NOT_FOUND");
            return;
        }

        socket.emit(
            "game:resume" as ServerToClientEvents,
            serializeResumePayload(room),
        );
    });

    socket.on("mode:leave", () => {
        leaveSocketRoomNow(socket, roomService);
    });

    socket.on("room:start", () => {
        const { identity, roomId } = socket.data as SocketData;
        if (!roomId) return;

        const room = roomService.getRoom(roomId);
        if (!room || room.status === "playing") return;

        if (room.gameConfig.mode === "custom") {
            const playerId = identity?.id;
            if (!playerId) return;
            const result = startCustomRoom(roomService, roomId, playerId);
            if (!result.ok) emitError(socket, result.reason ?? "ROOM_START_FAILED");
            return;
        }

        startGame(room, roomService);
    });

    socket.on("game:stop", async () => {
        interruptGameSession(socket, roomService);
    });
}

// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
