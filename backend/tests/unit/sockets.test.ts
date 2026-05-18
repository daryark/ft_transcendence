process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

import socketSetup from '../../sockets';

describe('sockets/index connection', () => {
  test('on connection emits game:config and registers handlers', () => {
    const listeners: Record<string, Function> = {};

    const io: any = {
      on: (event: string, cb: Function) => {
        listeners[event] = cb;
      },
      to: jest.fn(() => ({ emit: jest.fn() })),
    };

    // create socket mock
    const socket = {
      id: 'socket-1',
      handshake: { auth: {} },
      data: {},
      emit: jest.fn(),
      on: jest.fn((event: string, cb: Function) => {
        // store event registration
      }),
      join: jest.fn(),
    } as any;

    // call setup
    socketSetup(io);

    // simulate connection
    expect(typeof listeners['connection']).toBe('function');
    listeners['connection'](socket);

    // should emit game config
    expect(socket.emit).toHaveBeenCalled();
    const calledWith = (socket.emit as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === 'game:config'
    );
    expect(calledWith).toBeDefined();

    // should attach player to socket.data
    expect(socket.data.player).toBeDefined();

    // should register handlers (gameHandlers registers at least 'mode:join' and 'player:move')
    const registeredEvents = (socket.on as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(registeredEvents).toEqual(expect.arrayContaining(['mode:join', 'player:move', 'disconnect']));
  });
});
