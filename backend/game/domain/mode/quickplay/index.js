import { createCipheriv } from 'node:crypto';
import { createConfig, applyModifiers } from '../../../config/presets';
import { startGame } from '../match/startGame';

export default function join(socket, roomService, payload = {}) {
    //     validateModifiers(payload.gameConfig?.modifiers || {});

    let room = roomService.getRoom(mode);
    if (!room) {
        room = {
            mode: 'quickplay',
            ...createConfig('quickplay'),
            ...payload,
        };

        roomService.createRoom(room);
    }

    //!auto add as a spectator, always able to press start (after > 1player - auto start) and change from spectator=>player
    //!auto become spectator when finished the game
    //!but in both prev cases => passive spectator! (from lobby seeing players ratings changes and chat)
    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig.preset}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));

    if (room.players.length === 2) {
        startGame(room, roomService);
    }

    return roomService.getRoomState(room.id);
}

// function leaveQuickplay(socket) {
//     const roomId = socket.data.roomId;
//     if (!roomId) return;


module.exports = {
    join,
};