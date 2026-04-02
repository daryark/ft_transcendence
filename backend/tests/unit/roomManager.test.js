const roomManager = require('../../game/rooms/roomManager');

describe('Room Manager', () => {

    afterEach(() => {
        roomManager.clearRooms();
    });

    test('should create room and add player', () => {
        roomManager.addPlayerToRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room).toBeDefined();
        expect(room.players).toContain('socket1');
    });

    test('should not duplicate players', () => {
        roomManager.addPlayerToRoom('room1', 'socket1');
        roomManager.addPlayerToRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room.players.length).toBe(1);
    });

    test('should remove player and delete room if no players left', () => {
        roomManager.addPlayerToRoom('room1', 'socket1');
        roomManager.deletePlayerFromRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room).toBeUndefined();
    });
})