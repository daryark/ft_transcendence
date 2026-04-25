"use strict";
module.exports = function chatHandlers(io, socket) {
    socket.on('chat:message', (data) => {
        const { roomId } = socket.data;
        if (!roomId)
            return;
        io.to(roomId).emit('chat:message', {
            sender: socket.id,
            message: data.message || data //! enforce {message: '...'} format and remove "|| data" part later
        });
    });
};
// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
