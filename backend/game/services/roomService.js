const PRESETS = require('../config/presets');

// class RoomService {
//   constructor() {
//     this.rooms = new Map();
//   }

//   createRoom(id, room) {
//     this.rooms.set(id, room);
//   }

//   getRoom(id) {
//     return this.rooms.get(id);
//   }

//   addPlayer(roomId, player) {
//     const room = this.rooms.get(roomId);
//     if (!room) return;

//     room.players.push(player);
//   }
// }
// module.exports = RoomService;

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
        deleteRoom(roomId) // optional, or separate into deleteRoom fn
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