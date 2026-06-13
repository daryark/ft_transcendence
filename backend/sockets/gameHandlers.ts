import { Socket } from "socket.io";
import { SocketData } from ".";
import { isInput } from "../game/domain/engine/input";
import { ModeService } from "../game/services/modeService";
import { GameMode } from "../game/config/gameConfig.types";
import RoomService from "../game/services/roomService";
import { ConfigPatch, ConfigPatchSchema } from "../game/config/config.schema";
import startGame from "../game/domain/match/startGame";

export type ClientToServerEvents =
    | "mode:join"
    | "mode:leave"
    | "room:start"
    | "player:move"
    | "game:resume"
    | "game:stop";

export type ServerToClientEvents =
    | "session:identity"
    | "game:start"
    | "game:update"
    | "game:resume"
    | "game:end"
    | "round:start"
    | "round:end"
    | "room:update"
    | "social:update"
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
                rank: player.profile?.rank,
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
    { modeService, roomService }:
        { modeService: ModeService; roomService: RoomService }) {

    socket.on("mode:join", ({ mode, payload = {} }:
        { mode: GameMode; payload?: ConfigPatch }) => {

        const parsedPayload = ConfigPatchSchema.safeParse(payload);
        if (!parsedPayload.success) {
            emitError(socket, "INVALID_CONFIG");
            return;
        }
        modeService.join(mode, socket, parsedPayload.data);
    });

    socket.on("player:move", (input: unknown) => {
        if (!isInput(input)) return;

        const { roomId, role } = socket.data as SocketData;
        if (roomId && role === "player") {
            const room = roomService.getRoom(roomId);
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
        const { identity, roomId, role } = socket.data as SocketData;
        if (roomId && identity && role) {

            role === "player"
                ? roomService.removePlayer(roomId, identity.id)
                : roomService.removeSpectator(roomId, identity.id);
        }
        if (roomId && roomService.isEmpty(roomId)) {
            roomService.deleteRoom(roomId);
        }
    });

    socket.on("room:start", () => {
        const { roomId } = socket.data as SocketData;
        if (!roomId) return;

        const room = roomService.getRoom(roomId);
        if (!room || room.status === "playing") return;

        startGame(room, roomService);
    });

    socket.on("game:stop", async () => {
        const { roomId, identity, role } = socket.data as SocketData;
        if (!roomId) return;

        const room = roomService.getRoom(roomId);
        if (!room) return;

        room.match?.stop();
        room.engine?.stop();

        if (room.gameConfig.mode === "solo" && room.gameConfig.objective.winCondition === "none") {
            roomService.broadcast(roomId, "game:end", {
                roomId,
                reason: "manual_exit",
                state: room.state,
                result: {
                    outcome: "defeat",
                    stats: null,
                },
            });

            roomService.deleteRoom(roomId);
            return;
        }

        // If solo mode -> delete entire room and do not persist stats
        if (room.gameConfig.mode === "solo") {
            roomService.deleteRoom(roomId);
            return;
        }

        // Multiplayer: remove the player from the room and do not persist stats
        if (identity && role === "player") {
            roomService.removePlayer(roomId, identity.id);
        }
    });
}

// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
