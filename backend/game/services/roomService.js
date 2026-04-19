const PRESETS = require('../config/presets');

class RoomService {
  constructor() {
    // this.rooms = new Room({ id: null, players: [], spectators: [], gameConfig: {} });
    this.rooms = new Map();
}

  createRoom(room) {
    if (!this.rooms.has(room.id)) {
      this.rooms.set(room.id, room);
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }


  addPlayer(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (!room.players.includes(player)) {
        room.players.push(player);
        }
    }

    removePlayer(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players = room.players.filter(p => p !== player);
        if (room.players.length === 0) {
            this.deleteRoom(roomId);
        }
    }

    clearRooms() {
        this.rooms.clear();
    }
    
    getRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        return {
            id: room.id,
            players: room.players,
            gameConfig: room.gameConfig
        };
    }
}

module.exports = RoomService;


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.