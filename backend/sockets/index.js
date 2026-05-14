const chatHandlers = require('./chatHandlers');
const gameHandlers = require('./gameHandlers');

const RoomService = require('../game/services/roomService');
const createModeService = require('../game/services/modeService');
const PlayerService = require('../game/services/playerService');

const { resolveIdentity } = require('../middleware/auth');

import configBase from '../game/config/configBase';
const mode = require('../game/domain/mode');


module.exports = function socketSetup(io) {
    const roomService = new RoomService(io);
    const modeService = createModeService({ mode, roomService });
    const playerService = new PlayerService();

    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);

        const identity = resolveIdentity(socket.handshake.auth);
        const player = playerService.getOrCreate(identity.userId, socket.id);
        socket.data.player = player;

        socket.emit('game:config', { ...configBase(identity.type) });
    });

    gameHandlers(socket, modeService);
    // chatHandlers(socket);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        delete socket.data.player;
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.