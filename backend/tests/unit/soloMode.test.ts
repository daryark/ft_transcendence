import joinSolo from '../../game/domain/mode/solo';

describe('solo mode join', () => {
  test('creates room, adds player, joins socket and starts game', () => {
    const socket: any = {
      id: 's1',
      data: {},
      join: jest.fn(),
    };

    const room = {
      id: 'ROOM1',
      status: 'lobby',
      players: [],
      gameConfig: { general: { boardHeight: 20, boardWidth: 10 }, mode: 'solo' }
    };

    const roomService: any = {
      createRoom: jest.fn(() => room),
      addPlayer: jest.fn(),
      getRoom: jest.fn(() => room),
      getRoomState: jest.fn(() => ({ id: 'ROOM1', status: 'lobby', players: ['s1'] })),
      broadcast: jest.fn(),
    };

    const state = joinSolo(socket, roomService, {});

    expect(roomService.createRoom).toHaveBeenCalled();
    expect(roomService.addPlayer).toHaveBeenCalledWith(room.id, socket.id);
    expect(socket.join).toHaveBeenCalledWith(room.id);
    expect(socket.data.roomId).toBe(room.id);
    expect(socket.data.role).toBe('player');
    expect(state).toBeDefined();
  });
});
