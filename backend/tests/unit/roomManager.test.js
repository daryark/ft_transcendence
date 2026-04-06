const roomManager = require('../../game/rooms/roomManager');

describe('Room Manager', () => {

    afterEach(() => {
        roomManager.clearRooms();
    });

    test('#1 should create room and add player', () => {
        roomManager.joinRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room).toBeDefined();
        expect(room.players).toContain('socket1');
    });

    test('#2 should not duplicate players', () => {
        roomManager.joinRoom('room1', 'socket1');
        roomManager.joinRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room.players.length).toBe(1);
    });

    test('#3 should remove player and delete room if no players left', () => {
        roomManager.joinRoom('room1', 'socket1');
        roomManager.leaveRoom('room1', 'socket1');
        const room = roomManager.getRoom('room1');

        expect(room).toBeUndefined();
    });

    test('#4 should reject player when room is full', () => {
        roomManager.joinRoom('room1', 'socket1', 'player', '1v1');
        roomManager.joinRoom('room1', 'socket2', 'player', '1v1');
        
        const result = roomManager.joinRoom('room1', 'socket3', 'player', '1v1');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('room_full');
    });

    test('#5 should allow spectators even if room is full', () => {
        roomManager.joinRoom('room1', 'socket1', 'player', '1v1');
        roomManager.joinRoom('room1', 'socket2', 'player', '1v1');
        
        const result = roomManager.joinRoom('room1', 'socket3', 'spectator', '1v1');
        expect(result.success).toBe(true);
        expect(result.role).toBe('spectator');

        const room = roomManager.getRoom('room1');
        expect(room.spectators).toContain('socket3');
    });

    test('#6 should create room with preset config', () => {
        roomManager.joinRoom('room1', 'socket1', 'player', 'quickplay');
        const room = roomManager.getRoom('room1');
        
        expect(room).toBeDefined();
        expect(room.gameConfig.preset).toBe('quickplay');
    });
});