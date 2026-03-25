module.exports = function registerSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('socket connected:', socket.id);

        socket.on('client:ping', (data) => { //socket.on = recv/listen for the event.
            console.log('Received ping from', socket.id, data);
            socket.emit('server:pong', { now: Date.now() }); //emit  = send the event.

            socket.on('join_room', (roomId) => {
            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room ${roomId}`);
});
        });

        /**
         * GAME EVENT (example placeholder)
         */
        socket.on('game:input', (data) => {
            console.log('Game input from', socket.id, data);

            // later:
            // validate input
            // update game state
        });

        /**
         * CHAT EVENT (example placeholder)
         */
        socket.on('chat:message', (msg) => {
            console.log('Chat message from', socket.id, msg);
            io.to("room1").emit('chat:message', msg);

            // later:
            // broadcast to room

            // send to everyone in room1 (temporary hardcode)
        });

        socket.on('disconnect', (reason) => {
            console.log('Client disconnected:', socket.id, reason);
        });
    });
};


