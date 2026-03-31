const roomManager = require('./game/rooms/roomManager');

module.exports = function gameHandlers(socketServer, socket) {

    socket.on('join_room', (roomId) => {
        //join the room on the socket
        //store connection context/data about the player in the room manager
        //add player via room manager
        //log that client on socket.id joined roomId
    });

    socket.on('disconnect', () => {
        //if room exists, remove player from room manager
    });
};