const PRESETS = require('../config/presets');
// const quickplay = require('../rooms/quickplay');
// const league = require('../rooms/league');
// const solo = require('../rooms/solo');
// const custom = require('../rooms/custom');

//-> 👉 If it affects simulation → gameConfig
//-> 👉 If it affects flow → modeConfig
//-> 👉 If it affects winning → matchConfig
//-> 👉 If it affects who can join → roomConfig
//# room = {
//#   mode: 'quickplay' | 'solo' | 'league' | 'custom',
//#   gameConfig: { ... },   // engine ONLY
//#   matchConfig: { ... },  // rounds, timers
//#   roomConfig: { ... },   // players, spectators
//#   modeConfig: { ... }    // special behavior per mode
//# };

const rooms = {};

function createRoom(room) {
    if (!rooms[room.id]) {
        rooms[room.id] = room;
    }
}

function getRoom(roomId) {
    return rooms[roomId];
}

function deleteRoom(roomId) {
    delete rooms[roomId];
}

function addPlayer(roomId, player) {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players.includes(player)) {
        room.players.push(player);
    }
}

function removePlayer(roomId, socketId) {
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter(p => p !== socketId);

    if (room.players.length === 0) {
        delete rooms[roomId]; // optional, or separate into deleteRoom fn
    }
}

function clearRooms() {
    for (const key in rooms) {
        delete rooms[key];
    }
}

function getRoomState(roomId) {
    const room = rooms[roomId];
    if (!room) return null;

    return {
        id: room.id,
        players: room.players,
        gameConfig: room.gameConfig
    };
}

module.exports = {
    createRoom,
    getRoom,
    deleteRoom,
    addPlayer,
    removePlayer,
    getRoomState,

    clearRooms
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.