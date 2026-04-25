"use strict";
module.exports = function startGame(room, roomService) {
    if (room.status === "playing")
        return;
    room.status = 'playing';
    room.state = {
        board: Array.from({ length: 20 }, () => Array(10).fill(0)),
        currentPiece: null
    };
    room.engine = createEngine(room, roomService);
    roomService.broadcast(room.id, "game:start", {
        roomId: room.id,
        state: room.state,
        config: room.gameConfig
    });
};
