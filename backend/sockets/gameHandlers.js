module.exports = function gameHandlers(socket, modeService) {

    socket.on("mode:join", ({ mode, payload }) => {
        modeService.join(mode, socket, payload);
    });
    // socket.on('join_room', ({ roomId, role, preset }) => {
    //     const result = roomManager.joinRoom(roomId, socket.id, role, preset);
   
    //     if (!result.success) {
    //         socket.emit('join_error', result.reason);
    //         return;
    //     }
        
    //     socket.join(roomId);

    //     socket.data.roomId = roomId; //#4
    //     socket.data.role = result.role;

    //     console.log(`Socket ${socket.id} joined room ${roomId} as ${result.role}. Game type: ${preset}`);
    //     console.log('ROOM STATE:', roomManager.getRoom(roomId));
    // });

    socket.on('disconnect', () => {
        const { roomId } = socket.data;
        
        if (roomId) {
            roomManager.removePlayer(roomId, socket.id);
            console.log(`Socket ${socket.id} left room ${roomId}`);
            console.log('ROOM STATE:', roomManager.getRoom(roomId));
        }
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.