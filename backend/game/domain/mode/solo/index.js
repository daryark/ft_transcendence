const { configBase } = require('../config/presets');
const { startGame } = require('../../match/startGame');

function join(socket, roomService, payload = {}) {
    const mode = 'solo';
    let room = roomService.createRoom(mode, {
        mode,
        gameConfig: configBase(),
        matchConfig: payload.matchConfig || {},
        roomConfig: payload.roomConfig || {}
    });
    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig.preset}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));

    startGame(room, roomService);

    return roomService.getRoomState(room.id);
};