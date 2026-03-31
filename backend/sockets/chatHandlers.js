module.exports = function chatHandlers(socketServer, socket) {

    socket.on('caht:message', (msg) => {
        //find the room the socket is connected to
        //err check if the room exists
        //server broadcast the message to all in room
    });
};