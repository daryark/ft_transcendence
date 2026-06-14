import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import gameHandlers from '../../sockets/gameHandlers';

jest.mock('../../game/domain/match/startGame', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../game/domain/mode/custom/index.js', () => ({
  removeCustomRoomParticipant: jest.fn(),
}));

import startGame from '../../game/domain/match/startGame';
import { removeCustomRoomParticipant } from '../../game/domain/mode/custom/index.js';

type GameHandlersSocket = Parameters<typeof gameHandlers>[0];
type GameHandlersDeps = Parameters<typeof gameHandlers>[1];
type EventHandler = (payload?: unknown) => void;

type TestSocket = {
  id: string;
  data: Record<string, unknown>;
  on: jest.MockedFunction<(event: string, handler: EventHandler) => void>;
  emit: jest.MockedFunction<(event: string, payload?: unknown) => void>;
  join: jest.MockedFunction<(roomId: string) => void>;
  leave: jest.MockedFunction<(roomId: string) => void>;
};

describe('gameHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createSocket(overrides: Partial<TestSocket> = {}): TestSocket {
    return {
      id: 'socket-1',
      data: {},
      on: jest.fn<(event: string, handler: EventHandler) => void>(),
      emit: jest.fn<(event: string, payload?: unknown) => void>(),
      join: jest.fn<(roomId: string) => void>(),
      leave: jest.fn<(roomId: string) => void>(),
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
    const payload = { gameConfig: { general: { boardWidth: 10 } } };
    const joinMock = jest.fn();
    const modeService = { join: joinMock };
    const roomService = { getRoom: jest.fn() };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:join');
    handler({ mode: 'solo', payload });//->here solo specifically

    expect(joinMock).toHaveBeenCalledWith('solo', socket, payload);
  });

  test('mode:join emits server:error and does not join when payload is invalid', () => {
    const socket = createSocket();
    const joinMock = jest.fn();
    const modeService = { join: joinMock };
    const roomService = { getRoom: jest.fn() };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:join');
    handler({ mode: 'solo', payload: { gameConfig: { general: { boardWidth: 99 } } } });

    expect(joinMock).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('server:error', { reason: 'INVALID_CONFIG' });
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

  test('game:resume emits the current server-authoritative room state', () => {
    const state = { gameOver: false, score: 42 };
    const room = {
      id: 'ROOM1',
      status: 'playing',
      state,
      engine: null,
      players: new Map(),
      gameConfig: { mode: 'solo' },
    };
    const socket = createSocket({ data: { roomId: 'ROOM1' } });
    const modeService = { join: jest.fn() };
    const roomService = { getRoom: jest.fn(() => room) };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'game:resume')();

    expect(socket.emit).toHaveBeenCalledWith('game:resume', {
      roomId: 'ROOM1',
      status: 'playing',
      state,
      config: room.gameConfig,
    });
  });

  test.each(['anonymous', 'registered'])(
    'room:start restarts an ended solo room for a %s player',
    (identityType) => {
      const playerId = 'user-1';
      const room = {
        status: 'ended',
        gameConfig: { mode: 'solo' },
        players: new Map([[playerId, { id: playerId }]]),
      };
      const socket = createSocket({
        data: {
          identity: { id: playerId, type: identityType },
          roomId: 'ROOM1',
          role: 'player',
        },
      });
      const modeService = { join: jest.fn() };
      const roomService = { getRoom: jest.fn(() => room) };

      registerGameHandlers(socket, { modeService, roomService });
      getRegisteredHandler(socket, 'room:start')();

      expect(startGame).toHaveBeenCalledWith(room, roomService);
    },
  );

  test('room:start ignores a room that is already playing', () => {
    const playerId = 'user-1';
    const socket = createSocket({
      data: {
        identity: { id: playerId, type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'player',
      },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({
        status: 'playing',
        gameConfig: { mode: 'solo' },
        players: new Map([[playerId, { id: playerId }]]),
      })),
    };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'room:start')();

    expect(startGame).not.toHaveBeenCalled();
  });

  test('mode:leave removes player from room when socket role is player', () => {
    const socket = createSocket({
      data: {
        identity: { id: 'user-1', type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'player',
      },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({
        gameConfig: { mode: 'quickplay' },
        status: 'lobby',
      })),
      removePlayer: jest.fn(),
      removeSpectator: jest.fn(),
      isEmpty: jest.fn(() => false),
      deleteRoom: jest.fn(),
      broadcast: jest.fn(),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:leave');
    handler();

    expect(roomService.removePlayer).toHaveBeenCalledWith('ROOM1', 'user-1');
    expect(roomService.removeSpectator).not.toHaveBeenCalled();
    expect(roomService.isEmpty).toHaveBeenCalledWith('ROOM1');
    expect(roomService.deleteRoom).not.toHaveBeenCalled();
  });

  test('mode:leave removes spectator from room when socket role is spectator', () => {
    const socket = createSocket({
      data: {
        identity: { id: 'user-1', type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'spectator',
      },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({
        gameConfig: { mode: 'quickplay' },
        status: 'lobby',
      })),
      removePlayer: jest.fn(),
      removeSpectator: jest.fn(),
      isEmpty: jest.fn(() => false),
      deleteRoom: jest.fn(),
      broadcast: jest.fn(),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:leave');
    handler();

    expect(roomService.removeSpectator).toHaveBeenCalledWith('ROOM1', 'user-1');
    expect(roomService.removePlayer).not.toHaveBeenCalled();
    expect(roomService.isEmpty).toHaveBeenCalledWith('ROOM1');
    expect(roomService.deleteRoom).not.toHaveBeenCalled();
  });

  test('mode:leave deletes room after the last player leaves', () => {
    const socket = createSocket({
      data: {
        identity: { id: 'user-1', type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'player',
      },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({
        gameConfig: { mode: 'quickplay' },
        status: 'lobby',
      })),
      removePlayer: jest.fn(),
      removeSpectator: jest.fn(),
      isEmpty: jest.fn(() => true),
      deleteRoom: jest.fn(),
      broadcast: jest.fn(),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'mode:leave');
    handler();

    expect(roomService.removePlayer).toHaveBeenCalledWith('ROOM1', 'user-1');
    expect(roomService.deleteRoom).toHaveBeenCalledWith('ROOM1');
  });

  test('player:move pushes input to room engine when socket has roomId', () => {
    const pushInput = jest.fn();
    const socket = createSocket({ data: { roomId: 'ROOM1', role: 'player' } });
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

  test('player:move pushes player id and input to custom versus engine', () => {
    const pushInput = jest.fn();
    const socket = createSocket({
      data: {
        identity: { id: 'user-1', type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'player',
      },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({
        gameConfig: { mode: 'custom' },
        engine: { pushInput },
      })),
    };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'player:move')({ type: 'left' });

    expect(pushInput).toHaveBeenCalledWith('user-1', { type: 'left' });
  });

  test('player:move forwards held-input release to the room engine', () => {
    const pushInput = jest.fn();
    const socket = createSocket({ data: { roomId: 'ROOM1', role: 'player' } });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({ engine: { pushInput } })),
    };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'player:move')({
      type: 'down',
      phase: 'release',
    });

    expect(pushInput).toHaveBeenCalledWith({
      type: 'down',
      phase: 'release',
    });
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
    const socket = createSocket({ data: { roomId: 'ROOM404', role: 'player' } });
    const modeService = { join: jest.fn() };
    const roomService = { getRoom: jest.fn<(roomId: string) => undefined>(() => undefined) };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');

    expect(() => handler({ type: 'left' })).not.toThrow();
    expect(roomService.getRoom).toHaveBeenCalledWith('ROOM404');
  });

  test('player:move ignores invalid input type', () => {
    const pushInput = jest.fn();
    const socket = createSocket({ data: { roomId: 'ROOM1', role: 'player' } });
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
    const socket = createSocket({ data: { roomId: 'ROOM1', role: 'player' } });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn<(roomId: string) => { engine: null }>(() => ({ engine: null })),
    };

    registerGameHandlers(socket, { modeService, roomService });

    const handler = getRegisteredHandler(socket, 'player:move');

    expect(() => handler({ type: 'left' })).not.toThrow();
    expect(roomService.getRoom).toHaveBeenCalledWith('ROOM1');
  });

  test('player:move ignores spectators', () => {
    const pushInput = jest.fn();
    const socket = createSocket({
      data: { roomId: 'ROOM1', role: 'spectator' },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({ engine: { pushInput } })),
    };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'player:move')({ type: 'left' });

    expect(roomService.getRoom).not.toHaveBeenCalled();
    expect(pushInput).not.toHaveBeenCalled();
  });

  test('game:stop removes custom participant without stopping the whole engine first', () => {
    const stopMatch = jest.fn();
    const stopEngine = jest.fn();
    const socket = createSocket({
      data: {
        identity: { id: 'user-1', type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'player',
      },
    });
    const modeService = { join: jest.fn() };
    const roomService = {
      getRoom: jest.fn(() => ({
        gameConfig: { mode: 'custom' },
        match: { stop: stopMatch },
        engine: { stop: stopEngine },
      })),
    };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'game:stop')();

    expect(socket.leave).toHaveBeenCalledWith('ROOM1');
    expect(socket.data.roomId).toBeUndefined();
    expect(socket.data.role).toBeUndefined();
    expect(removeCustomRoomParticipant).toHaveBeenCalledWith(
      roomService,
      'ROOM1',
      'user-1',
      'player',
    );
    expect(stopMatch).not.toHaveBeenCalled();
    expect(stopEngine).not.toHaveBeenCalled();
  });

  test('game:stop removes player and ends any non-custom multiplayer room', () => {
    const stopMatch = jest.fn();
    const stopEngine = jest.fn();
    const remainingPlayer = {
      id: 'user-2',
      profile: { nickname: 'Dasha' },
    };
    const socket = createSocket({
      data: {
        identity: { id: 'user-1', type: 'anonymous' },
        roomId: 'ROOM1',
        role: 'player',
      },
    });
    const modeService = { join: jest.fn() };
    const room = {
      gameConfig: { mode: 'quickplay' },
      status: 'playing',
      state: { score: 100 },
      players: new Map([['user-2', remainingPlayer]]),
      match: { stop: stopMatch },
      engine: { stop: stopEngine },
    };
    const roomService = {
      getRoom: jest.fn(() => room),
      removePlayer: jest.fn(),
      removeSpectator: jest.fn(),
      isEmpty: jest.fn(() => false),
      deleteRoom: jest.fn(),
      broadcast: jest.fn(),
    };

    registerGameHandlers(socket, { modeService, roomService });
    getRegisteredHandler(socket, 'game:stop')();

    expect(socket.leave).toHaveBeenCalledWith('ROOM1');
    expect(socket.data.roomId).toBeUndefined();
    expect(socket.data.role).toBeUndefined();
    expect(roomService.removePlayer).toHaveBeenCalledWith('ROOM1', 'user-1');
    expect(stopMatch).toHaveBeenCalled();
    expect(stopEngine).toHaveBeenCalled();
    expect(room.status).toBe('ended');
    expect(roomService.broadcast).toHaveBeenCalledWith(
      'ROOM1',
      'game:end',
      expect.objectContaining({
        reason: 'player_left',
        winnerId: 'user-2',
      }),
    );
    expect(roomService.deleteRoom).not.toHaveBeenCalled();
  });
});
