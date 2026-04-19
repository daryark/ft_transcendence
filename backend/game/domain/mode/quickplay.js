const { configBase, applyModifiers } = require('../../config/presets');
const { startGame } = require('../match/startGame');

function join(socket, roomService, payload) {
    validateModifiers(payload.gameConfig?.modifiers || {});

    const mode = 'quickplay';
    let room = roomService.getRoom(mode);
    if (!room) {
        room = {
            id: mode,
            mode,
            players: [],
            spectators: [],
            gameConfig: applyModifiers(configBase(), payload.gameConfig?.modifiers || {})
        };

        roomService.createRoom(room);
    }

    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;

    if (room.players.length === 2) {
        startGame(room, roomService);
    }

    return roomService.getRoomState(room.id);
}

function validateModifiers(modifiers = {}) {
    for (const key in modifiers) {
        for (const subKey in modifiers[key]) {
            if (typeof modifiers[key][subKey] !== 'boolean') {
                throw new TypeError(`Modifier "${key}.${subKey}" must be a boolean`);
            }
        }
    }
}

// function leaveQuickplay(socket) {
//     const roomId = socket.data.roomId;
//     if (!roomId) return;


module.exports = {
    join,
};