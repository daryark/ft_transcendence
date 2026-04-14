const chatHandlers = require('./chatHandlers');
const gameHandlers = require('./gameHandlers');

module.exports = function registerSocketHandlers(socketServer) {

    socketServer.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
    
        socket.on('client:ping', () => {
            socket.emit('server:pong', { now: Date.now() });
        });

        gameHandlers(socket);
        chatHandlers(socketServer, socket);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
