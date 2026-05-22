import { Socket } from "socket.io";
import type { ConfigPatch } from "../config/config.schema";
import RoomService, { RoomServiceRoomState } from "./roomService";
import { GameMode } from "../config/gameConfig.types";

export type ModeService = ReturnType<typeof createModeService>;

export type ModeJoinHandler = (
    socket: Socket,
    roomService: RoomService,
    payload?: ConfigPatch
) => RoomServiceRoomState | null;

export default function createModeService(
    { modes, roomService }:
    { modes: Record<GameMode, ModeJoinHandler>; roomService: RoomService }) {

    function join(mode: GameMode, socket: Socket, payload: ConfigPatch = {}) {
        const handler = modes[mode];
        if (!handler) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });//! or throw err
            return;
        }

        return handler(socket, roomService, payload); //! remove try/catch here (handle at socket layer)
    }

    return {
        join,
    };
}
