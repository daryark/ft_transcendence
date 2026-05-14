
export type ModeService = ReturnType<typeof createModeService>;

module.exports = function createModeService({ modes, roomService: RoomServiceApi }) {
    function join(mode, socket, payload = {}) {
        const handler = modes[mode];
        if (!handler?.join) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });//! or throw err
            return;
        }

        return handler.join(socket, roomService, payload); //! remove try/catch here (handle at socket layer)
    }

    function leave(mode, socket, payload = {}) {
        const handler = modes[mode];
        if (!handler?.leave) {
            socket.emit('mode_error', { reason: "INVALID_MODE" });//! or throw err
            return;
        }

        return handler.leave(socket, roomService, payload);
    }

    return {
        join,
        leave,
    };
}
