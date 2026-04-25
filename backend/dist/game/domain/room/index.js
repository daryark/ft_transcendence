"use strict";
class Room {
    constructor({ id, mode, players = [], gameConfig = {} }) {
        this.id = id;
        this.mode = mode;
        this.players = players;
        this.spectators = [];
        this.gameConfig = gameConfig;
    }
}
module.exports = Room;
