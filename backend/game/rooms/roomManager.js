const rooms = {};

function createRoom(roomId, type) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            type: type,
            players: [],
            spectators : [],
            maxPlayers: getMaxPlayers(type)
        };
    }
}

function joinRoom(roomId, socketId, role = 'player', type = '1v1') {
    createRoom(roomId, type);

    const room = rooms[roomId];

    if (room.players.includes(socketId) || room.spectators.includes(socketId)) {
            return { success: false, reason: 'player_is_in_room' };
    }
    
    if (role === 'player') {
        if (room.players.length >= room.maxPlayers) {
            return { success: false, reason: 'room_full' };
        }

        room.players.push(socketId);
        return { success: true, role: 'player' };
    }

    if (role === 'spectator') {
        room.spectators.push(socketId);
        return { success: true, role: 'spectator' };
    }

    return { success: false, reason: 'invalid_role' };
}

function leaveRoom(roomId, socketId) {
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter(id => id !== socketId);
    room.spectators = room.spectators.filter(id => id !== socketId);

    //!delete room if empty (use deleteRoom fn later)
    if (room.players.length === 0) {
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

function clearRooms() {
    for (const key in rooms) {
        delete rooms[key];
    }
}

/**
 * Get max players based on room type
 */
function getMaxPlayers(type) {
    switch (type) {
        case 'solo': return 1;
        case '1v1': return 2;
        case 'league': return 2;
        case 'multiplayer': return 100; //!can be modified later on server growth
        case 'room': return Infinity; //!can be modified (during room setup)
        default: return 2;
    }
}

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    getAllRooms,
    clearRooms
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.