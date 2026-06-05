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
    jest.advanceTimersByTime(TICK_MS);
    engine.stop();

    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:update', room.state);
  });

  test('queued input is applied on next tick', () => {
    const room = createRoom();
    const startX = room.state!.current.x;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engine.pushInput({ type: 'left' });
    jest.advanceTimersByTime(TICK_MS);
    engine.stop();

    expect(room.state!.current.x).toBe(startX - 1);
  });

  test('grounded piece locks after lock delay even if rotated repeatedly', () => {
    const room = createRoom();
    room.state!.current = createFigure('J', room.state!.cols);
    room.state!.current.y = room.state!.rows - room.state!.current.shape.length;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);

    for (let elapsed = 0; elapsed < 600; elapsed += 100) {
      engine.pushInput({ type: 'rotate' });
      jest.advanceTimersByTime(TICK_MS);
    }
    jest.advanceTimersByTime(TICK_MS * 60);

    engine.stop();

    expect(room.state!.board.flat().some((cell) => cell === 1)).toBe(true);
  });

  test('unrotated grounded piece locks in half the configured delay', () => {
    const room = createRoom();
    room.state!.current = createFigure('O', room.state!.cols);
    room.state!.current.y = room.state!.rows - room.state!.current.shape.length;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    jest.advanceTimersByTime(TICK_MS * 31);
    engine.stop();

    expect(room.state!.board.flat().some((cell) => cell === 1)).toBe(true);
  });

  test('rotation can kick a J piece away from the right wall', () => {
    const room = createRoom();
    room.state!.current = createFigure('J', room.state!.cols);
    room.state!.current.shape = figures.J[3];
    room.state!.current.x = room.state!.cols - 2;
    room.state!.current.y = 0;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engine.pushInput({ type: 'rotate' });
    jest.advanceTimersByTime(TICK_MS);
    engine.stop();

    expect(room.state!.current.x).toBe(room.state!.cols - 3);
  });

  test('time objective emits game:end', () => {
    const config = createConfig('solo');
    config.gameConfig.objective!.winCondition = 'time';
    config.gameConfig.objective!.timeLimit = 0;
    const room = createRoom(config as Partial<Room>);
    const roomService = { broadcast: jest.fn() };

    createEngine(room, roomService);
    jest.advanceTimersByTime(TICK_MS);

    expect(room.status).toBe('ended');
    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:end', {
      roomId: room.id,
      reason: 'objective_complete',
      state: room.state,
      result: expect.objectContaining({
        outcome: 'win',
        stats: expect.objectContaining({
          score: room.state!.score,
          lines: room.state!.lines,
          round: room.state!.round,
        }),
      }),
    });
  });

  test('zen solo restarts instead of ending on game over', () => {
    const config = createConfig('solo');
    config.gameConfig.objective!.winCondition = 'none';
    const room = createRoom(config as Partial<Room>);
    room.state!.gameOver = true;
    const firstRound = room.state!.round;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    jest.advanceTimersByTime(TICK_MS);
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
