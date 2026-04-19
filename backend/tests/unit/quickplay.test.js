const quickplay = require('../../game/domain/mode/quickplay');
const RoomService = require('../../game/services/roomService');

describe('Quickplay', () => {
    let roomService;

    beforeEach(() => {
        roomService = new RoomService();
    });

    afterEach(() => {
        roomService.clearRooms();
    });

    describe('join', () => {
        test('should create quickplay room on first join', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            quickplay.join(socket, roomService, {});

            const room = roomService.getRoom('quickplay');
            expect(room).toBeDefined();
            expect(room.mode).toBe('quickplay');
            expect(room.players).toContain('s1');
        });

        test('should add player to existing quickplay room', () => {
            const socket1 = { id: 's1', join: jest.fn(), data: {} };
            const socket2 = { id: 's2', join: jest.fn(), data: {} };

            quickplay.join(socket1, roomService, {});
            quickplay.join(socket2, roomService, {});

            const room = roomService.getRoom('quickplay');
            expect(room.players).toContain('s1');
            expect(room.players).toContain('s2');
            expect(room.players.length).toBe(2);
        });

        test('should call socket.join with room id', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            quickplay.join(socket, roomService, {});

            expect(socket.join).toHaveBeenCalledWith('quickplay');
        });

        test('should set socket data roomId', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            quickplay.join(socket, roomService, {});

            expect(socket.data.roomId).toBe('quickplay');
        });

        test('should return room state', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            const state = quickplay.join(socket, roomService, {});

            expect(state).toBeDefined();
            expect(state.id).toBe('quickplay');
            expect(state.players).toContain('s1');
            expect(state.gameConfig).toBeDefined();
        });

        test('should apply modifiers to game config', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            const state = quickplay.join(socket, roomService, { gameConfig: { modifiers: { garbage: { volatile: true } } } });

            expect(state.gameConfig.garbage.volatile).toBe(true);
        });

        test('should apply multiple modifiers to game config', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            const state = quickplay.join(socket, roomService, { gameConfig: { modifiers: { garbage: { volatile: true, sticky: true } } } });

            expect(state.gameConfig.garbage.volatile).toBe(true);
            expect(state.gameConfig.garbage.sticky).toBe(true);
        });

        test('should throw TypeError for non-boolean modifier', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            expect(() => {
                quickplay.join(socket, roomService, { gameConfig: { modifiers: { garbage: { volatile: "true" } } } });
            }).toThrow(TypeError);

            expect(() => {
                quickplay.join(socket, roomService, { gameConfig: { modifiers: { garbage: { volatile: null } } } });
            }).toThrow(TypeError);
        });

        test('should initialize room with empty spectators array', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            quickplay.join(socket, roomService, {});

            const room = roomService.getRoom('quickplay');
            expect(room.spectators).toEqual([]);
        });

        test('should not duplicate player if same socket joins multiple times', () => {
            const socket = { id: 's1', join: jest.fn(), data: {} };

            quickplay.join(socket, roomService, {});
            quickplay.join(socket, roomService, {});

            const room = roomService.getRoom('quickplay');
            expect(room.players.length).toBe(1);
        });
    });

});