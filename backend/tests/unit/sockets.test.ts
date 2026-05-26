process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

import socketSetup from '../../sockets';

describe('sockets/index connection', () => {
  test('on connection emits game:config and registers handlers', () => {
    const listeners: Record<string, Function> = {};
    let middleware: Function | undefined;

    const io: any = {
      use: jest.fn((cb: Function) => {
        middleware = cb;
      }),
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

    expect(io.use).toHaveBeenCalled();
    expect(middleware).toBeDefined();
    middleware!(socket, (error?: Error) => {
      expect(error).toBeUndefined();
    });

    // simulate connection
    expect(typeof listeners['connection']).toBe('function');
    listeners['connection'](socket);

    // should emit game config
    expect(socket.emit).toHaveBeenCalled();
    const calledWith = (socket.emit as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === 'game:config'
    );
    expect(calledWith).toBeDefined();

    // should attach identity/session data to socket.data
    expect(socket.data.identity).toEqual(expect.objectContaining({ type: 'anonymous' }));
    expect(socket.data.joinedAt).toEqual(expect.any(Number));

    //? should register handlers (gameHandlers registers at least 'mode:join' and 'player:move')
    const registeredEvents = (socket.on as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(registeredEvents).toEqual(expect.arrayContaining(['mode:join', 'player:move', 'mode:leave', 'disconnect']));
  });
});
