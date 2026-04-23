const chatHandlers = require('./chatHandlers');
const gameHandlers = require('./gameHandlers');
const RoomService = require('../game/services/roomService');
const createModeService = require('../game/services/modeService');
const mode = require('../game/domain/mode');

module.exports = function socketSetup(io) {
    const roomService = new RoomService(io);
    const modeService = createModeService({mode, roomService});

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
    
        socket.on('client:ping', () => {
            socket.emit('server:pong', { now: Date.now() });
        });

        gameHandlers(socket, modeService);
        // chatHandlers(socket);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.