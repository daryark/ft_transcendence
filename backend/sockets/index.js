const chatHandlers = require('./chatHandlers');
const gameHandlers = require('./gameHandlers');
const RoomService = require('../game/services/roomService');
const createModeService = require('../game/services/modeService');
const PlayerService = require('../game/services/playerService');
const { verifyToken } = require('../auth/tokenUtils');
const { randomUUID } = require('crypto');
const mode = require('../game/domain/mode');


module.exports = function socketSetup(io) {
    const roomService = new RoomService(io);
    const modeService = createModeService({mode, roomService});
    const playerService = new PlayerService();

    io.on("connection", (socket) => {
        console.log('New client connected:', socket.id);
        const { token } = socket.handshake.auth;
        const playerId = token ? verifyToken(token) : randomUUID();

        const player = playerService.getOrCreate(playerId, socket.id);
        socket.data.player = player;

        socket.on('client:ping', () => {
            socket.emit('server:pong', { now: Date.now() });
        });

        gameHandlers(socket, modeService);
        // chatHandlers(socket);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            delete socket.data.player;
        });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.