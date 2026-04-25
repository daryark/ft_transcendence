"use strict";
const PRESETS = require('../config/presets');
class RoomService {
    constructor(io) {
        // this.rooms = new Room({ id: null, players: [], spectators: [], gameConfig: {} });
        this.rooms = new Map();
        this.queue = new Array();
        this.io = this.io;
    }
    createRoom(roomId, partial = {}) {
        const room = {
            id: roomId,
            status: 'lobby',
            players: [],
            spectators: [],
            state: null,
            engine: null,
            ...partial
        };
        this.rooms.set(room.id, room);
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }
    addPlayer(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        if (!room.players.includes(player)) {
            room.players.push(player);
        }
    }
    addSpectator(roomId, spectator) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        if (!room.spectators.includes(spectator)) {
            room.spectators.push(spectator);
        }
    }
    removePlayer(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        room.players = room.players.filter(p => p !== player);
        if (room.players.length === 0) {
            this.deleteRoom(roomId);
        }
    }
    removeSpectator(roomId, spectator) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        room.spectators = room.spectators.filter(s => s !== spectator);
    }
    enqueue(socket) {
        this.queue.push(socket);
    }
    dequeue(socketId) {
        return this.queue = this.queue.filter(p => p.id !== socketId);
    }
    startGame(room) {
        if (room.status === "playing")
            return;
        room.status = 'playing';
        room.state = {
            board: Array.from({ length: 20 }, () => Array(10).fill(0)),
            currentPiece: null
        };
        room.engine = createEngine(room, roomService);
        roomService.broadcast(room.id, "game:start", {
            roomId: room.id,
            state: room.state,
            config: room.gameConfig
        });
    }
    clearRooms() {
        this.rooms.clear();
    }
    getRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return null;
        return {
            id: room.id,
            players: room.players,
            gameConfig: room.gameConfig
        };
    }
}
module.exports = RoomService;
// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
