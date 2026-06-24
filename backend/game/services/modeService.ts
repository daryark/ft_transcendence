import { Socket } from "socket.io";
import type { ConfigPatch } from "../config/config.schema";
import RoomService, { RoomServiceRoomState } from "./roomService";
import { GameMode } from "../config/gameConfig.types";
import PlayerService from "./playerService";
import { emitError } from "../../sockets/gameHandlers";

export type ModeService = ReturnType<typeof createModeService>;

export type ModeJoinHandler = (
    socket: Socket,
    { roomService, playerService }:
    {roomService: RoomService, playerService: PlayerService},
    payload: ConfigPatch
) => RoomServiceRoomState | null;

export default function createModeService(
    { modes, roomService, playerService }:
    {
        modes: Partial<Record<GameMode, ModeJoinHandler>>; //modes: Record<GameMode, ModeJoinHandler>;
        roomService: RoomService, playerService: PlayerService }) {

    function join(mode: GameMode, socket: Socket, payload: ConfigPatch = {}) {
        const handler = modes[mode];
        if (!handler) {
            emitError(socket, "INVALID_MODE");
            return;
        }

        return handler(socket, { roomService, playerService }, payload); //! remove try/catch here (handle at socket layer)
    }

    return {
        join,
    };
}
