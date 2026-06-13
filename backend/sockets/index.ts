import type { Server } from "socket.io";

import RoomService from '../game/services/roomService';
import PlayerService from '../game/services/playerService';
import createModeService from '../game/services/modeService';

import chatHandlers from "./chatHandlers";
import gameHandlers from "./gameHandlers";
import disconnectHandlers from "./disconnectHandler";

import modes from '../game/domain/mode';
import { socketAuth } from "../middleware/socketAuth";
import { configDTO } from "../game/config/configDTO";

import type { RoomId } from "../game/domain/room";
import type { Identity } from "../auth/identity";
import { Roles } from "../game/domain/player";
import { setSocketServer, userSocketRoom } from "./realtime";


export type SocketData = {
    identity: Identity;
    roomId?: RoomId;
    joinedAt: number;
    role?: Roles | undefined;
};

export default function socketSetup(io: Server) {
    setSocketServer(io);
    const roomService = new RoomService(io);
    const playerService = new PlayerService();
    const modeService = createModeService({ modes, roomService, playerService });

    io.use(socketAuth(playerService));
    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);
        if (socket.data.roomId) {
            socket.join(socket.data.roomId);
        }
        if (socket.data.identity?.type === "registered") {
            socket.join(userSocketRoom(socket.data.identity.id));
        }
        socket.emit('game:config', configDTO);

        gameHandlers(socket, { modeService, roomService });
        chatHandlers(io, socket);

        disconnectHandlers(socket, { roomService, playerService });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
