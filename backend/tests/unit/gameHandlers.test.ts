import { describe, expect, jest, test } from '@jest/globals';
import gameHandlers from '../../sockets/gameHandlers';

type GameHandlersSocket = Parameters<typeof gameHandlers>[0];
type GameHandlersDeps = Parameters<typeof gameHandlers>[1];
type EventHandler = (payload?: unknown) => void;

type TestSocket = {
  id: string;
  data: Record<string, unknown>;
  on: jest.MockedFunction<(event: string, handler: EventHandler) => void>;
  emit: jest.MockedFunction<(event: string, payload?: unknown) => void>;
  join: jest.MockedFunction<(roomId: string) => void>;
};

describe('gameHandlers', () => {
  function createSocket(overrides: Partial<TestSocket> = {}): TestSocket {
    return {
      id: 'socket-1',
      data: {},
      on: jest.fn<(event: string, handler: EventHandler) => void>(),
      emit: jest.fn<(event: string, payload?: unknown) => void>(),
      join: jest.fn<(roomId: string) => void>(),
      ...overrides,
    };
  }

  function registerGameHandlers(socket: TestSocket, deps: unknown) {
    gameHandlers(socket as unknown as GameHandlersSocket, deps as GameHandlersDeps);
  }

  function getRegisteredHandler(socket: TestSocket, event: string): EventHandler {
    const registered = socket.on.mock.calls.find(call => call[0] === event);
    expect(registered).toBeDefined();
    return registered![1];
  }

  test('registers mode:join listener', () => {
    const socket = createSocket();
    const modeService = { join: jest.fn() };
    const roomService = { getRoom: jest.fn() };

    registerGameHandlers(socket, { modeService, roomService });

    expect(socket.on).toHaveBeenCalledWith('mode:join', expect.any(Function));
  });

  //->works only with 'solo' mode, because other modes are not implemented yet.
  test('mode:join with solo calls modeService.join with socket and payload', () => {
    const socket = createSocket();
    const payload = { general: { boardWidth: 10 } };
    const joinMock = jest.fn();
    const modeService = { join: joinMock };
    const roomService = { getRoom: jest.fn() };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:join');
    handler({ mode: 'solo', payload });//->here solo specifically

    expect(joinMock).toHaveBeenCalledWith('solo', socket, payload);
  });

  test('mode:join with solo defaults missing payload to empty object', () => {
    const socket = createSocket();
    const joinMock = jest.fn();
    const modeService = { join: joinMock };
    const roomService = { getRoom: jest.fn() };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:join');
    handler({ mode: 'solo' });//->here solo specifically

    expect(joinMock).toHaveBeenCalledWith('solo', socket, {});
  });

  test('registers player:move listener', () => {
    const socket = createSocket();
    const modeService = { join: jest.fn() };
    const roomService = { getRoom: jest.fn() };

    registerGameHandlers(socket, { modeService, roomService });

    expect(socket.on).toHaveBeenCalledWith('player:move', expect.any(Function));
  });

  test('player:move pushes input to room engine when socket has roomId', () => {
    const pushInput = jest.fn();
    const socket = createSocket({ data: { roomId: 'ROOM1' } });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn<(roomId: string) => { engine: { pushInput: typeof pushInput } }>(
        () => ({ engine: { pushInput } })
      ),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');
    handler({ type: 'left' });

    expect(roomService.getRoom).toHaveBeenCalledWith('ROOM1');
    expect(pushInput).toHaveBeenCalledWith({ type: 'left' });
  });

  test('player:move does nothing when socket has no roomId', () => {
    const socket = createSocket({ data: {} });
    const modeService = { join: jest.fn() };
    const roomService = { getRoom: jest.fn<(roomId: string) => unknown>() };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');
    handler({ type: 'left' });

    expect(roomService.getRoom).not.toHaveBeenCalled();
  });

  test('player:move does not throw when room does not exist', () => {
    const socket = createSocket({ data: { roomId: 'ROOM404' } });
    const modeService = { join: jest.fn() };
    const roomService = { getRoom: jest.fn<(roomId: string) => undefined>(() => undefined) };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');

    expect(() => handler({ type: 'left' })).not.toThrow();
    expect(roomService.getRoom).toHaveBeenCalledWith('ROOM404');
  });

  test('player:move ignores invalid input type', () => {
    const pushInput = jest.fn();
    const socket = createSocket({ data: { roomId: 'ROOM1' } });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn<(roomId: string) => { engine: { pushInput: typeof pushInput } }>(
        () => ({ engine: { pushInput } })
      ),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');
    handler({ type: 'teleport' });

    expect(roomService.getRoom).not.toHaveBeenCalled();
    expect(pushInput).not.toHaveBeenCalled();
  });

  test('player:move does not throw when room exists without engine', () => {
    const socket = createSocket({ data: { roomId: 'ROOM1' } });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn<(roomId: string) => { engine: null }>(() => ({ engine: null })),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');

    expect(() => handler({ type: 'left' })).not.toThrow();
    expect(roomService.getRoom).toHaveBeenCalledWith('ROOM1');
  });
});
