import type { Server } from "socket.io";

import RoomService from '../game/services/roomService';
import PlayerService from '../game/services/playerService';
import createModeService from '../game/services/modeService';

import chatHandlers from "./chatHandlers";
import gameHandlers from "./gameHandlers";
import disconnectHandlers from "./disconnectHandler";

import modes from '../game/domain/mode';
import { socketAuth } from "../middleware/socketAuth";
import { configBase } from "../game/config/configBase";

import type { RoomId } from "../game/domain/room";
import type { Identity } from "../auth/identity";


export type SocketData = {
    identity: Identity;
    roomId?: RoomId;
    joinedAt: number;
    role?: 'player' | 'spectator';
};

export default function socketSetup(io: Server) {
    const roomService = new RoomService(io);
    const modeService = createModeService({ modes, roomService });
    const playerService = new PlayerService();

    io.use(socketAuth(playerService));
    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);
        socket.emit('game:config', { ...configBase(socket.data.identity.type) });

        gameHandlers(socket, { modeService, roomService });
        // chatHandlers(socket);

        disconnectHandlers(socket, { roomService });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.