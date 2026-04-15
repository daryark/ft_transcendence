
module.exports = function createModeService({modes, roomService}) {
    function join(mode, socket, payload) {
        const handler = modes[mode];
        if (!handler?.join) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });
            return;
        }
        
        try {
            return handler.join(socket, roomService, payload);
        } catch (err) {
            socket.emit('mode_error', { reason: "MODE_JOIN_FAILED" });
        }
    }
    return { join };
}
