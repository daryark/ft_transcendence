"use strict";
const { configBase, applyModifiers } = require('../../config/presets');
const { startGame } = require('../match/startGame');
function join(socket, roomService, payload = {}) {
    //     validateModifiers(payload.gameConfig?.modifiers || {});
    const mode = 'quickplay';
    let room = roomService.getRoom(mode);
    if (!room) {
        room = {
            mode,
            gameConfig: applyModifiers(configBase(), payload?.gameConfig?.modifiers),
            matchConfig: payload.matchConfig || {},
            roomConfig: payload.roomConfig || {},
        };
        roomService.createRoom(mode, room);
    }
    //!auto add as a spectator, always able to press start (after > 1player - auto start) and change from spectator=>player
    //!auto become spectator when finished the game
    //!but in both prev cases => passive spectator! (from lobby seeing players ratings changes and chat)
    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    if (room.players.length === 2) {
        startGame(room, roomService);
    }
    return roomService.getRoomState(room.id);
}
//#connect TS or do validation fn for the basic config for all modes. In game/config/
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
