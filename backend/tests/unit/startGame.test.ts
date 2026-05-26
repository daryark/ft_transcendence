import { afterEach, describe, expect, jest, test } from '@jest/globals';
import startGame from '../../game/domain/match/startGame';
import { createConfig } from '../../game/config/configBase';
import type Room from '../../game/domain/room';
import type { RoomId } from '../../game/domain/room';

function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'R123' as RoomId,
    status: 'lobby',
    players: new Map(),
    state: null,
    engine: null,
    ...createConfig('solo'),
    ...overrides,
  };
}

describe('startGame solo flow', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes state, engine and broadcasts game:start', () => {
    jest.useFakeTimers();
    const room = createRoom();
    const roomService: any = { broadcast: jest.fn() };

    startGame(room, roomService);

    expect(room.status).toBe('playing');
    expect(room.state).toBeDefined();
    expect(room.state?.rows).toBe(20);
    expect(room.state?.cols).toBe(10);
    expect(room.engine).toBeDefined();
    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:start', {
      roomId: room.id,
      state: room.state,
      config: room.gameConfig,
    });

    room.engine?.stop();
  });

  test('does nothing if room already playing', () => {
    const room = createRoom({ status: 'playing' });
    const roomService: any = { broadcast: jest.fn() };

    startGame(room, roomService);

    expect(roomService.broadcast).not.toHaveBeenCalled();
    expect(room.state).toBeNull();
    expect(room.engine).toBeNull();
  });
});
