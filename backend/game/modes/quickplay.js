const roomManager = require('../rooms/roomManager');
const { quickplayBase, applyModifiers } = require('../config/presets');

// const QUICKPLAY_ROOM_ID = 'quickplay_pool';

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

function joinQuickplay(socket, modifiers) {
    validateModifiers(modifiers);
    const poolKey = getPoolKey(modifiers);

    let room = roomManager.getRoom(poolKey);
    if (!room) {
        const baseConfig = quickplayBase();
        const gameConfig = applyModifiers(baseConfig, modifiers);
    
        room = {
            id: poolKey,
            mode: 'quickplay',
            players: [],
            gameConfig
        };

        roomManager.createRoom(poolKey, room);
    }

    roomManager.addPlayer(poolKey, socket.id);
    socket.join(poolKey);
    socket.data.roomId = poolKey;

    return roomManager.getRoomState(poolKey);
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