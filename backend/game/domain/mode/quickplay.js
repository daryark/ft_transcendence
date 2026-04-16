const { configBase, applyModifiers } = require('../config/presets');

function join(socket, roomService, payload) {
    validateModifiers(payload.modifiers);
    const poolKey = getPoolKey(payload.modifiers);

    let room = roomService.getRoom(poolKey);
    if (!room) {
        room = {
            id: poolKey,
            mode: 'quickplay',
            players: [],
            spectators: [],
            gameConfig: applyModifiers(configBase(), payload.modifiers)
        };

        roomService.createRoom(room);
    }

    roomService.addPlayer(poolKey, socket.id);
    socket.join(poolKey);
    socket.data.roomId = poolKey;

    return roomService.getRoomState(poolKey);
}

function validateModifiers(modifiers = {}) {
    for (const key in modifiers) {
        if (typeof modifiers[key] !== 'boolean') {
            throw new TypeError(`Modifier "${key}" must be a boolean`);
        }
    }
}

function getPoolKey(modifiers) {
    return `quickplay:${Object.entries(modifiers).
        map(([k, v]) => `${k}=${v}`)
        .sort()
        .join('|')}`;
}

function leaveQuickplay(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    roomManager.removePlayer(roomId, socket.id);
    // if room empty for X minutes → delete
    // socket.leave(roomId);
    // delete socket.data.roomId;
}


module.exports = {
    joinQuickplay,
    leaveQuickplay
};