import gameHandlers from '../../sockets/gameHandlers';

describe('gameHandlers', () => {
  test('mode:join calls modeService.join with correct args', () => {
    const socket: any = {
      id: 'socket-1',
      data: {},
      on: jest.fn((event, cb) => { /* register */ }),
      emit: jest.fn(),
      join: jest.fn(),
    };

    const joinMock = jest.fn(() => ({ id: 'R1', status: 'lobby', players: ['socket-1'] }));
    const modeService: any = { join: joinMock };

    const roomService: any = {
      getRoom: jest.fn(),
      removePlayer: jest.fn(),
    };

    gameHandlers(socket, { modeService, roomService });

    // find registered handler for mode:join
    const registered = (socket.on as jest.Mock).mock.calls.find(c => c[0] === 'mode:join');
    expect(registered).toBeDefined();

    // invoke handler
    const handler = registered[1];
    handler({ mode: 'solo', payload: {} });

    expect(joinMock).toHaveBeenCalledWith('solo', socket, {});
  });

  test('player:move pushes input to room engine when roomId set', () => {
    const pushInput = jest.fn();
    const socket: any = {
      id: 'socket-2',
      data: { roomId: 'ROOM1' },
      on: jest.fn((event, cb) => { /* register */ }),
      emit: jest.fn(),
    };

    const roomService: any = {
      getRoom: jest.fn(() => ({ engine: { pushInput } })),
      removePlayer: jest.fn(),
    };

    const modeService: any = { join: jest.fn() };

    gameHandlers(socket, { modeService, roomService });

    const reg = (socket.on as jest.Mock).mock.calls.find(c => c[0] === 'player:move');
    expect(reg).toBeDefined();
    const h = reg[1];

    h({ type: 'left' });
    expect(pushInput).toHaveBeenCalledWith('left');
  });

  test('disconnect removes player from roomService', () => {
    const socket: any = {
      id: 'socket-d',
      data: { roomId: 'ROOMX' },
      on: jest.fn((event, cb) => { /* register */ }),
      emit: jest.fn(),
    };

    const roomService: any = {
      getRoom: jest.fn(),
      removePlayer: jest.fn(),
    };

    const modeService: any = { join: jest.fn() };

    gameHandlers(socket, { modeService, roomService });

    const reg = (socket.on as jest.Mock).mock.calls.find(c => c[0] === 'disconnect');
    expect(reg).toBeDefined();
    const h = reg[1];

    h();
    expect(roomService.removePlayer).toHaveBeenCalledWith('ROOMX', 'socket-d');
  });
});
