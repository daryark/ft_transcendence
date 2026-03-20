module.exports = function registerSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('socket connected:', socket.id);

        socket.on('client:ping', (data) => { //socket.on = recv/listen for the event.
            console.log('Received ping from', socket.id, data);
            socket.emit('server:pong', { now: Date.now() }); //emit  = send the event.
        });

        socket.on('disconnect', (reason) => {
            console.log('Client disconnected:', socket.id, reason);
        });
    });
};


