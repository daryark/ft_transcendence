import chatHandlers from "./chatHandlers";
import gameHandlers from "./gameHandlers";

import RoomService from '../game/services/roomService';
import createModeService from '../game/services/modeService';
import PlayerService from '../game/services/playerService';

const { resolveIdentity } = require('../middleware/auth');

import { configBase } from '../game/config/presets';
import modes from '../game/domain/mode';

export default function socketSetup(io) {
    const roomService = new RoomService(io);
    const modeService = createModeService({ modes, roomService });
    const playerService = new PlayerService();

    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);

        const identity = resolveIdentity(socket.handshake.auth);
        const player = playerService.getOrCreate(identity.userId, socket.id);
        socket.data.player = player;

        socket.emit('game:config', { ...configBase(identity.type) });
    });

    gameHandlers(socket, { modeService, roomService });
    // chatHandlers(socket);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        delete socket.data.player;
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.