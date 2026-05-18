import { Socket } from "socket.io";
import { Input } from "../game/domain/engine/tetrisEngline";
import { ModeService } from "../game/services/modeService";
import { GameMode } from "../game/config/gameConfig.types";
import { SocketData } from ".";
import RoomService from "../game/services/roomService";
import Config from "../game/config/config.types";

export type ClientToServerEvents = "mode:join" | "mode:leave" | "room:start" | "player:move";

export type ServerToClientEvents = "game:start" | "game:update" | "game:end" | "room:update" | "room:error";



//!move to separate file?


export default function gameHandlers(
    socket: Socket,
    {  modeService, roomService }:
    { modeService: ModeService; roomService: RoomService }) {

    socket.on("mode:join", ({ mode, payload = {} }:
        { mode: GameMode; payload?: Partial<Config> }) => {
        modeService.join(mode, socket, payload);
    });

    socket.on("player:move", ({ type }: Input) => {
        const { roomId } = socket.data as SocketData;
        if (roomId) {
            const room = roomService.getRoom(roomId);
            room?.engine.pushInput(type);
        }
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.