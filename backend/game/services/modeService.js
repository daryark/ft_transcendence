
module.exports = function createModeService({modes, roomService}) {
    function join(mode, socket, payload) {
        const handler = modes[mode];
        if (!handler?.join) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });//! or throw err
            return;
        }
        
        return handler.join(socket, roomService, payload); //! remove try/catch here (handle at socket layer)
    }
    return { join };
}
