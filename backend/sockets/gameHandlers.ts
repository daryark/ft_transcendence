import { Socket } from "socket.io";
import { SocketData } from ".";
import { isInput } from "../game/domain/engine/input";
import { ModeService } from "../game/services/modeService";
import { GameMode } from "../game/config/gameConfig.types";
import RoomService from "../game/services/roomService";
import { ConfigPatch, ConfigPatchSchema } from "../game/config/config.schema";

export type ClientToServerEvents = "mode:join" | "mode:leave" | "room:start" | "player:move";

export type ServerToClientEvents = "game:start" | "game:update" | "game:end" | "room:update" | "room:error";


export default function gameHandlers(
    socket: Socket, {  modeService, roomService }:
    { modeService: ModeService; roomService: RoomService }) {

    socket.on("mode:join", ({ mode, payload = {} }:
        { mode: GameMode; payload?: ConfigPatch }) => {
        const parsedPayload = ConfigPatchSchema.safeParse(payload);

        if (!parsedPayload.success) {
            socket.emit("mode_error", { reason: "INVALID_CONFIG" });
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
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
