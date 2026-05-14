import { Socket } from "socket.io";
import Config from "../config/config.types";
import { RoomServiceApi, RoomServiceRoomState } from "./roomService";
import { GameMode } from "../config/gameConfig.types";

export type ModeService = ReturnType<typeof createModeService>;

export type ModeHandler = {
    join: (socket: Socket, roomService: RoomServiceApi, payload?: Partial<Config>) =>  RoomServiceRoomState | null;
    leave?: (socket: Socket, roomService: RoomServiceApi, payload?: Partial<Config>) => any;
};

export function createModeService(
    { modes, roomService }:
    { modes: Record<GameMode, ModeHandler>; roomService: RoomServiceApi }) {

    function join(mode:GameMode, socket: Socket, payload = {}) {
        const handler = modes[mode];
        if (!handler?.join) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });//! or throw err
            return;
        }

        return handler.join(socket, roomService, payload); //! remove try/catch here (handle at socket layer)
    }

    function leave(mode:GameMode, socket: Socket, payload = {}) {
        const handler = modes[mode];
        if (!handler?.leave) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });//! or throw err
            return;
        }

        return handler.leave(socket, roomService, payload);
    }

    return {
        join,
        leave,
    };
}
