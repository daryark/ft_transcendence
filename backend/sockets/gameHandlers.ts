import { Socket } from "socket.io";
import { Input } from "../game/domain/engine/tetrisEngline";
import { RoomId } from "../game/domain/room";
import { ModeService } from "../game/services/modeService";
import RoomService from "../game/services/roomService";
import Config from "../game/config/config.types";
import { GameMode } from "../game/config/gameConfig.types";

export type ClientToServerEvents = "mode:join" | "mode:leave" | "room:start" | "player:move";

export type ServerToClientEvents = "game:start" | "game:update" | "game:end" | "room:update" | "room:error";


export type SocketData = {
    roomId?: RoomId;
    playerId?: string;
};

//!move to separate file?


export default function gameHandlers(socket: Socket,
    {  modeService, roomService }: { modeService: ModeService; roomService: RoomService }) {
    //!config can be sent partically, so won't be of the type Config...but should be validated somehow
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


    socket.on('disconnect', () => {
        const { roomId } = socket.data as SocketData;

        if (roomId) {
            roomService.removePlayer(roomId, socket.id);
            console.log(`Socket ${socket.id} left room ${roomId}`);
            console.log('ROOM STATE:', roomService.getRoom(roomId));
        }
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.