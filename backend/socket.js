const chatHandlers = require('./sockets/chatHandlers');
const gameHandlers = require('./sockets/gameHandlers');

module.exports = function registerSocketHandlers(socketServer) {

    socketServer.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
    
        socket.on('client:ping', () => {
            socket.emit('server:pong', { now: Date.now() });
        });

        gameHandlers(socketServer, socket);
        chatHandlers(socketServer, socket);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
};









// const roomManager = require('./game/rooms/roomManager');

// module.exports = function registerSocketHandlers(io) {
//     io.on('connection', (socket) => {
//         console.log('socket connected:', socket.id);

//         socket.on('client:ping', (data) => { //socket.on = recv/listen for the event.
//             console.log('Received ping from', socket.id, data);
//             socket.emit('server:pong', { now: Date.now() }); //emit  = send the event.

//             socket.on('join_room', (roomId) => {
//             socket.join(roomId);

//             roomManager.addPlayerToRoom(roomId, socket.id);

//             console.log(`Socket ${socket.id} joined room ${roomId}`);
//             console.log('ROOM STATE:', roomManager.getRoom(roomId));
//                 });
//             });

//         /**
//          * GAME EVENT (example placeholder)
//          */
//         socket.on('game:input', (data) => {
//             console.log('Game input from', socket.id, data);

//             // later:
//             // validate input
//             // update game state
//         });

//         /**
//          * CHAT EVENT (example placeholder)
//          */
//        socket.on('chat:message', ({ roomId, message }) => {
//             console.log(`Message in ${roomId}:`, message);

//             io.to(roomId).emit('chat:message', {
//                 sender: socket.id,
//                 message,
//             });
//         });

//         socket.on('disconnect', () => {
//             console.log('Client disconnected:', socket.id);

//             const rooms = roomManager.getAllRooms();

//             for (const roomId in rooms) {
//                 roomManager.removePlayerFromRoom(roomId, socket.id);
//             }
//         });
//     });
// };


