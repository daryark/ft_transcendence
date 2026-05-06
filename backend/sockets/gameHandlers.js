module.exports = function gameHandlers(socket, modeService) {

    socket.on("mode:join", ({ mode, payload = {} }) => {
        modeService.join(mode, socket, payload);
    });

    socket.on("player:move", ({ direction }) => {
        const { roomId } = socket.data;
        if (roomId) {
            modeService.getRoom(roomId).engine.pushInput(direction);
        }
    });


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