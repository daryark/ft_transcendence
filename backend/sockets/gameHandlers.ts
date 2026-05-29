import { Socket } from "socket.io";
import { SocketData } from ".";
import { isInput } from "../game/domain/engine/input";
import { ModeService } from "../game/services/modeService";
import { GameMode } from "../game/config/gameConfig.types";
import RoomService from "../game/services/roomService";
import { ConfigPatch, ConfigPatchSchema } from "../game/config/config.schema";
import startGame from "../game/domain/match/startGame";

export type ClientToServerEvents = "mode:join" | "mode:leave" | "room:start" | "player:move" | "game:stop";

export type ServerToClientEvents = "game:start" | "game:update" | "game:end" | "room:update" | "server:error";

export function emitError(socket: Socket, reason: string) {
    socket.emit("server:error" as ServerToClientEvents, { reason });
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

        const { roomId } = socket.data as SocketData;
        if (roomId) {
            const room = roomService.getRoom(roomId);
            room?.engine?.pushInput(input);
        }
    });

    socket.on("mode:leave", () => {
        const { identity, roomId, role } = socket.data as SocketData;
        if (roomId && identity && role) {

            role === "player"
                ? roomService.removePlayer(roomId, identity.id)
                : roomService.removeSpectator(roomId, identity.id);
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

        // Stop engine if running
        room.engine?.stop();

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
