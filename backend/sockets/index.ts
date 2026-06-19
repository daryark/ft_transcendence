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
import { setNotificationSocketServer } from "../notifications/hub";


export type SocketData = {
    identity: Identity;
    roomId?: RoomId;
    joinedAt: number;
    role?: Roles | undefined;
    replacedSocketId?: string;
};

export default function socketSetup(io: Server) {
    setSocketServer(io);
    setNotificationSocketServer(io);
    const roomService = new RoomService(io);
    const playerService = new PlayerService();
    const modeService = createModeService({ modes, roomService, playerService });

    io.use(socketAuth(playerService));
    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);
        if (socket.data.replacedSocketId && socket.data.replacedSocketId !== socket.id) {
            const replacedSocket = io.sockets.sockets.get(socket.data.replacedSocketId);
            replacedSocket?.emit("server:error", {
                reason: "CLIENT_REPLACED",
                message: "You joined this room on another client, replacing this one.",
            });
            setTimeout(() => replacedSocket?.disconnect(true), 50);
        }
        socket.emit("session:identity", {
            id: socket.data.identity.id,
        });
        if (socket.data.roomId) {
            socket.join(socket.data.roomId);
        }
        if (socket.data.identity?.type === "registered") {
            socket.join(userSocketRoom(socket.data.identity.id));
        }
        socket.emit('game:config', configDTO);

        gameHandlers(socket, { modeService, roomService });
        chatHandlers(io, socket, { roomService });

        disconnectHandlers(socket, { roomService, playerService });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
