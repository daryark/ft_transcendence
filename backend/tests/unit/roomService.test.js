const _RoomService = require('../../game/services/roomService');
const RoomService = _RoomService.default || _RoomService;

describe('RoomService', () => {
    let roomService;

    beforeEach(() => {
        roomService = new RoomService();
    });

    afterEach(() => {
        roomService.clearRooms();
    });

    describe('createRoom', () => {
        test('should create a new room', () => {
            roomService.createRoom({ id: 'room1', players: [], gameConfig: {} });
            const room = roomService.getRoom('room1');

            expect(room).toBeDefined();
            expect(room.id).toBe('room1');
        });

        test('should not overwrite existing room', () => {
            roomService.createRoom({ id: 'room1', players: [], gameConfig: {} });
            roomService.createRoom({ id: 'room1', players: ['socket1'], gameConfig: { test: true } });

            const room = roomService.getRoom('room1');
            expect(room.players).toEqual([]);
            expect(room.gameConfig.test).toBeUndefined();//!
        });
    });

    describe('addPlayer', () => {
        beforeEach(() => {
            roomService.createRoom({ id: 'room1', players: [], gameConfig: {} });
        });

        test('should add a player to a room', () => {
            roomService.addPlayer('room1', 'socket1');
            const room = roomService.getRoom('room1');

            expect(room.players).toContain('socket1');
        });

        test('should not duplicate players', () => {
            roomService.addPlayer('room1', 'socket1');
            roomService.addPlayer('room1', 'socket1');
            const room = roomService.getRoom('room1');

            expect(room.players.length).toBe(1);
        });

        test('should add multiple players to a room', () => {
            roomService.addPlayer('room1', 'socket1');
            roomService.addPlayer('room1', 'socket2');
            roomService.addPlayer('room1', 'socket3');
            const room = roomService.getRoom('room1');

            expect(room.players.length).toBe(3);
            expect(room.players).toContain('socket1');
            expect(room.players).toContain('socket2');
            expect(room.players).toContain('socket3');
        });
    });

    describe('removePlayer', () => {
        beforeEach(() => {
            roomService.createRoom({ id: 'room1', players: [], gameConfig: {} });
        });

        test('should remove a player from a room', () => {
            roomService.addPlayer('room1', 'socket1');
            roomService.addPlayer('room1', 'socket2');
            roomService.removePlayer('room1', 'socket1');
            const room = roomService.getRoom('room1');

            expect(room.players).not.toContain('socket1');
            expect(room.players).toContain('socket2');
        });

        test('should delete room when last player is removed', () => {
            roomService.addPlayer('room1', 'socket1');
            roomService.removePlayer('room1', 'socket1');
            const room = roomService.getRoom('room1');

            expect(room).toBeUndefined();
        });
    });

    describe('getRoom', () => {
        test('should return a room by id', () => {
            roomService.createRoom({ id: 'room1', players: ['socket1'], gameConfig: { mode: 'classic' } });
            const room = roomService.getRoom('room1');

            expect(room).toBeDefined();
            expect(room.id).toBe('room1');
            expect(room.players).toContain('socket1');
        });

        test('should return undefined for non-existent room', () => {
            const room = roomService.getRoom('nonexistent');

            expect(room).toBeUndefined();
        });
    });

    describe('deleteRoom', () => {
        test('should delete a room', () => {
            roomService.createRoom({ id: 'room1', players: [], gameConfig: {} });
            roomService.deleteRoom('room1');
            const room = roomService.getRoom('room1');

            expect(room).toBeUndefined();
        });
    });

    describe('getRoomState', () => {
        test('should return room state', () => {
            roomService.createRoom({ id: 'room1', players: ['s1', 's2'], gameConfig: { test: true } });

            const state = roomService.getRoomState('room1');

            expect(state).toBeDefined();
            expect(state.id).toBe('room1');
            expect(state.players).toEqual(['s1', 's2']);
            expect(state.gameConfig.test).toBe(true);
        });

        test('should return null for non-existent room', () => {
            const state = roomService.getRoomState('nonexistent');

            expect(state).toBeNull();
        });
    });

    describe('clearRooms', () => {
        test('should clear all rooms', () => {
            roomService.createRoom({ id: 'room1', players: [], gameConfig: {} });
            roomService.createRoom({ id: 'room2', players: [], gameConfig: {} });
            roomService.clearRooms();

            expect(roomService.getRoom('room1')).toBeUndefined();
            expect(roomService.getRoom('room2')).toBeUndefined();
        });
    });

});