const rooms = {};

function createRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            players: [],
            spectators : [],
        };
    }
}

function addPlayerToRoom(roomId, socketId) {
    createRoom(roomId);

    if (!rooms[roomId].players.includes(socketId)) {
        rooms[roomId].players.push(socketId);
    }
}

function removePlayerFromRoom(roomId, socketId) {
    if (rooms[roomId]) {
        rooms[roomId].players = rooms[roomId].players.filter(id => id !== socketId);
    }

    //delete room if empty (use deleteRoom fn later)
    if (rooms[roomId] && rooms[roomId].players.length === 0
        && rooms[roomId].spectators.length === 0) {
        delete rooms[roomId];
    }
}

/**
 * Get room data
 */
function getRoom(roomId) {
    return rooms[roomId];
}

/**
 * Get all rooms (for debug)
 */
function getAllRooms() {
    return rooms;
}

module.exports = {
    createRoom,
    addPlayerToRoom,
    removePlayerFromRoom,
    getRoom,
    getAllRooms,
};