const roomManager = require('../../game/rooms/roomManager');

describe('Room Manager', () => {

    afterEach(() => {
        roomManager.clearRooms();
    });

    test('should create room and add player', () => {
        roomManager.joinRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room).toBeDefined();
        expect(room.players).toContain('socket1');
    });

    test('should not duplicate players', () => {
        roomManager.joinRoom('room1', 'socket1');
        roomManager.joinRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room.players.length).toBe(1);
    });

    test('should remove player and delete room if no players left', () => {
        roomManager.joinRoom('room1', 'socket1');
        roomManager.leaveRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room).toBeUndefined();
    });

    test('should reject player when room is full', () => {
        roomManager.joinRoom('room1', 'socket1');
        roomManager.joinRoom('room1', 'socket2');
        
        const result = roomManager.joinRoom('room1', 'socket3');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('room_full');
    });

    test('should allow spectators even if room is full', () => {
        roomManager.joinRoom('room1', 'socket1');
        roomManager.joinRoom('room1', 'socket2');
        
        const result = roomManager.joinRoom('room1', 'socket3', 'spectator');
        expect(result.success).toBe(true);
        expect(result.role).toBe('spectator');

        const room = roomManager.getRoom('room1');
        expect(room.spectators).toContain('socket3');
    });
});