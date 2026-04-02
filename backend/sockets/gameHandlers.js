const roomManager = require('../game/rooms/roomManager');

module.exports = function gameHandlers(socketServer, socket) {
    // void socketServer;

    socket.on('join_room', (roomId) => {
        socket.join(roomId);

        socket.data.roomId = roomId; //#4
        socket.data.role = 'player';

        roomManager.addPlayerToRoom(roomId, socket.id);

        console.log(`Socket ${socket.id} joined room ${roomId}`);
        console.log('ROOM STATE:', roomManager.getRoom(roomId));
    });

    socket.on('disconnect', () => {
        const { roomId } = socket.data;
        
        if (roomId) {
            roomManager.deletePlayerFromRoom(roomId, socket.id);
            console.log(`Socket ${socket.id} left room ${roomId}`);
            console.log('ROOM STATE:', roomManager.getRoom(roomId));
        }
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.