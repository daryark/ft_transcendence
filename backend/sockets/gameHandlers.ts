import { Socket } from "socket.io";
import { Input } from "../game/domain/engine/tetrisEngline";
import Room from "../game/domain/room";
// import ModeService from "../game/services/modeService";
// import RoomManager from "../game/services/roomManager";

export type ClientToServerEvents = "mode:join" | "mode:leave" | "room:start" | "player:move";

export type ServerToClientEvents = "game:start" | "game:update" | "game:end" | "room:update" | "room:error";


export type SocketData = {
    roomId?: string;
    playerId?: string;
};

//!move to separate file?


export default function gameHandlers(socket: Socket, modeService: ModeService) {
    //!config can be sent partically, so won't be of the type Config...but should be validated somehow
    socket.on("mode:join", ({ mode, config = {} }: any) => {
        modeService.join(mode, socket, config);
    });

    socket.on("player:move", ({ type }: Input) => {
        const { roomId } = socket.data as SocketData;
        if (roomId) {
            const room = modeService.getRoom(roomId) as Room;
            room?.engine.pushInput(type);
        }
    });


    socket.on('disconnect', () => {
        const { roomId } = socket.data as SocketData;

        if (roomId) {
            roomManager.removePlayer(roomId, socket.id);
            console.log(`Socket ${socket.id} left room ${roomId}`);
            console.log('ROOM STATE:', roomManager.getRoom(roomId));
        }
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.