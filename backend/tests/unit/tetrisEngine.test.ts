import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import createEngine from '../../game/domain/engine/tetrisEngline';
import { TICK_MS } from '../../game/domain/engine/tetrisEngline';
import { createFigure, figures } from '../../game/domain/engine/figures';
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
  const engines: Array<{ stop: () => void }> = [];

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    for (const engine of engines.splice(0)) {
      engine.stop();
    }
    jest.useRealTimers();
  });

  test('broadcasts game:update on tick', () => {
    const room = createRoom();
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    jest.advanceTimersByTime(TICK_MS);

    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:update', room.state);
    engine.stop();
  });

  test('queued input is applied on next tick', () => {
    const room = createRoom();
    const startX = room.state!.current.x;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'left' });
    jest.advanceTimersByTime(TICK_MS);

    expect(room.state!.current.x).toBe(startX - 1);
    engine.stop();
  });

  test('grounded piece locks after lock delay even if rotated repeatedly', () => {
    const room = createRoom();
    room.state!.current = createFigure('J', room.state!.cols);
    room.state!.current.y = room.state!.rows - room.state!.current.shape.length;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);

    for (let elapsed = 0; elapsed < 600; elapsed += 100) {
      engine.pushInput({ type: 'rotate' });
      jest.advanceTimersByTime(TICK_MS);
    }
    jest.advanceTimersByTime(TICK_MS * 60);

    expect(room.state!.board.flat().some((cell) => cell === 1)).toBe(true);
    engine.stop();
  });

  test('unrotated grounded piece locks in half the configured delay', () => {
    const room = createRoom();
    room.state!.current = createFigure('O', room.state!.cols);
    room.state!.current.y = room.state!.rows - room.state!.current.shape.length;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    jest.advanceTimersByTime(TICK_MS * 31);

    expect(room.state!.board.flat().some((cell) => cell === 1)).toBe(true);
    engine.stop();
  });

  test('rotation can kick a J piece away from the right wall', () => {
    const room = createRoom();
    room.state!.current = createFigure('J', room.state!.cols);
    room.state!.current.shape = figures.J[3];
    room.state!.current.x = room.state!.cols - 2;
    room.state!.current.y = 0;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'rotate' });
    jest.advanceTimersByTime(TICK_MS);

    expect(room.state!.current.x).toBe(room.state!.cols - 3);
    engine.stop();
  });
});
