import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import createEngine from '../../game/domain/engine/tetrisEngline';
import { initGame } from '../../game/domain/engine/state';
import { createConfig } from '../../game/config/configBase';
import type Room from '../../game/domain/room';
import type { RoomId } from '../../game/domain/room';

function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'ROOM1' as RoomId,
    status: 'playing',
    players: new Map(),
    state: initGame(20, 10),
    engine: null,
    ...createConfig('solo'),
    ...overrides,
  };
}

describe('tetris engine solo runtime loop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('broadcasts game:update on tick', () => {
    const room = createRoom();
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    jest.advanceTimersByTime(100);
    engine.stop();

    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:update', room.state);
  });

  test('queued input is applied on next tick', () => {
    const room = createRoom();
    const startX = room.state!.current.x;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engine.pushInput({ type: 'left' });
    jest.advanceTimersByTime(100);
    engine.stop();

    expect(room.state!.current.x).toBe(startX - 1);
  });

  test('time objective emits game:end', () => {
    const config = createConfig('solo');
    config.gameConfig.objective.winCondition = 'time';
    config.gameConfig.objective.timeLimit = 0;
    const room = createRoom(config as Partial<Room>);
    const roomService = { broadcast: jest.fn() };

    createEngine(room, roomService);
    jest.advanceTimersByTime(100);

    expect(room.status).toBe('ended');
    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:end', {
      roomId: room.id,
      reason: 'objective_complete',
      state: room.state,
    });
  });

  test('zen solo restarts instead of ending on game over', () => {
    const config = createConfig('solo');
    config.gameConfig.objective.winCondition = 'none';
    const room = createRoom(config as Partial<Room>);
    room.state!.gameOver = true;
    const firstRound = room.state!.round;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    jest.advanceTimersByTime(100);
    engine.stop();

    expect(room.status).toBe('playing');
    expect(room.state!.round).toBe(firstRound + 1);
    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:start', {
      roomId: room.id,
      state: room.state,
      config: room.gameConfig,
    });
  });
});
