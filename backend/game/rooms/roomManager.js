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

// function createRoom(roomId, preset = 'quickplay') {
//     if (!rooms[roomId]) {
//         rooms[roomId] = {
//             id: roomId, //!is it the one from socket.io that always changes or a custom one?
            
//             players: [],
//             spectators : [],
            
//             gameConfig: {
//                 preset: preset,
//                 settings: PRESETS[preset]
//             },
//             roomConfig: {
//                 maxPlayers: getMaxPlayers(preset)
//             },
//             matchconfig: {},
//         };
//     }
// }

// function joinRoom(roomId, socketId, role = 'player', preset = 'quickplay') {
//     createRoom(roomId, preset);

//     const room = rooms[roomId];

//     if (room.players.includes(socketId) || room.spectators.includes(socketId)) {
//             return { success: false, reason: 'player_is_in_room' };
//     }
    
//     if (role === 'player') {
//         if (room.players.length >= room.roomConfig.maxPlayers) {
//             return { success: false, reason: 'room_full' };
//         }

//         room.players.push(socketId);
//         return { success: true, role: 'player' };
//     }

//     if (role === 'spectator') {
//         room.spectators.push(socketId);
//         return { success: true, role: 'spectator' };
//     }

//     return { success: false, reason: 'invalid_role' };
// }

// function leaveRoom(roomId, socketId) {
//     const room = rooms[roomId];
//     if (!room) return;

//     room.players = room.players.filter(id => id !== socketId);
//     room.spectators = room.spectators.filter(id => id !== socketId);

//     //!delete room if empty (use deleteRoom fn later)
//     if (room.players.length === 0) {
//         delete rooms[roomId];
//     }
// }

// /**
//  * Get room data
//  */
// function getRoom(roomId) {
//     return rooms[roomId];
// }

// /**
//  * Get all rooms (for debug)
//  */
// function getAllRooms() {
//     return rooms;
// }

// function clearRooms() {
//     for (const key in rooms) {
//         delete rooms[key];
//     }
// }

// /**
//  * Get max players based on room type
//  */
// function getMaxPlayers(preset) {
//     switch (preset) {
//         case 'solo': return 1;
//         case '1v1': return 2;
//         case 'league': return 2;
//         case 'quickplay': return 100; //!can be modified later on server growth
//         case 'room': return Infinity; //!can be modified (during room setup)
//         default: return 2;
//     }
// }


function createRoom(roomId, data) {
    if (!rooms[roomId]) {
        rooms[roomId] = data;
    }
    //!check if the config(data) is valid before creating the room
}

function getRoom(roomId) {
    return rooms[roomId];
}

function deleteRoom(roomId) {
    delete rooms[roomId];
}

function addPlayer(roomId, player) { //joinRoom
    const room = rooms[roomId];
    if (!room) return;

    room.players.push(player);
}

function removePlayer(roomId, socketId) { //leaveRoom
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socketId);

    if (room.players.length === 0) {
        delete rooms[roomId]; // optional, or separate into deleteRoom fn
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
    getRoomState
};

// module.exports = {
//     createRoom,
//     joinRoom,
//     leaveRoom,
//     getRoom,
//     getAllRooms,
//     clearRooms
// };


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.