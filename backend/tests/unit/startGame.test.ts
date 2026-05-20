import startGame from '../../game/domain/match/startGame';

describe('startGame', () => {
  test('initializes state, engine and broadcasts game:start', () => {
    const room: any = {
      id: 'R123',
      status: 'lobby',
      gameConfig: { general: { boardHeight: 20, boardWidth: 10 }, mode: 'solo' }
    };

    const broadcast = jest.fn();
    const roomService: any = { broadcast, getRoom: jest.fn(() => room) };

    startGame(room, roomService);

    expect(room.status).toBe('playing');
    expect(room.state).toBeDefined();
    expect(room.engine).toBeDefined();
    expect(broadcast).toHaveBeenCalledWith(room.id, 'game:start', expect.any(Object));
  });

  test('does nothing if room already playing', () => {
    const room: any = { id: 'R2', status: 'playing' };
    const roomService: any = { broadcast: jest.fn() };

    startGame(room, roomService);
    expect(roomService.broadcast).not.toHaveBeenCalled();
  });
});
