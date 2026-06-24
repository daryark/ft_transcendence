import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import createEngine from '../../game/domain/engine/tetrisEngine';
import { TICK_MS } from '../../game/domain/engine/tetrisEngine';
import { createFigure, figureCellValues, figures } from '../../game/domain/engine/figures';
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

  test('release removes queued repeats but preserves the initial tap', () => {
    const room = createRoom();
    const startX = room.state!.current.x;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'left' });
    engine.pushInput({ type: 'left', repeat: true });
    engine.pushInput({ type: 'left', repeat: true });
    engine.pushInput({ type: 'left', phase: 'release' });
    jest.advanceTimersByTime(TICK_MS);

    expect(room.state!.current.x).toBe(startX - 1);
  });

  test('counts a piece only when it locks', () => {
    const room = createRoom();
    room.state!.current = createFigure('T', room.state!.cols);
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'drop' });
    jest.advanceTimersByTime(TICK_MS);

    expect(room.state!.piecesPlaced).toBe(1);
    expect(room.state!.update.piecesPlaced).toBe(1);
    expect(
      room.state!.board.flat().filter((cell) => cell !== 0),
    ).toEqual(Array(4).fill(figureCellValues.T));
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

    expect(
      room.state!.board.flat().some((cell) => cell === figureCellValues.J),
    ).toBe(true);
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

    expect(
      room.state!.board.flat().some((cell) => cell === figureCellValues.O),
    ).toBe(true);
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

  test('tops out when the next piece is blocked at spawn', () => {
    const room = createRoom();
    const state = room.state!;
    state.current = createFigure('I', state.cols);
    state.current.shape = figures.I[1];
    state.current.x = -2;
    state.next = [createFigure('O', state.cols)];
    state.buffer[state.buffer.length - 3][4] = figureCellValues.J;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'drop' });
    jest.advanceTimersByTime(TICK_MS);

    expect(state.gameOver).toBe(true);
  });

  test('blocks at the visible ceiling do not cause top out', () => {
    const room = createRoom();
    const state = room.state!;
    state.current = createFigure('I', state.cols);
    state.current.shape = figures.I[1];
    state.current.x = -2;
    state.next = [createFigure('O', state.cols)];
    state.board[0][4] = figureCellValues.J;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'drop' });
    jest.advanceTimersByTime(TICK_MS);

    expect(state.gameOver).toBe(false);
    expect(state.current.type).toBe('O');
    expect(state.current.y).toBe(-3);
  });

  test('keeps side-stack cells above the visible board', () => {
    const room = createRoom();
    const state = room.state!;
    state.current = createFigure('I', state.cols);
    state.next = [createFigure('T', state.cols)];
    state.buffer[state.buffer.length - 4][0] = figureCellValues.L;
    state.buffer[state.buffer.length - 3][0] = figureCellValues.L;
    const roomService = { broadcast: jest.fn() };

    const engine = createEngine(room, roomService);
    engines.push(engine);
    engine.pushInput({ type: 'drop' });
    jest.advanceTimersByTime(TICK_MS);

    expect(state.buffer[state.buffer.length - 4][0]).toBe(
      figureCellValues.L,
    );
    expect(state.buffer[state.buffer.length - 3][0]).toBe(
      figureCellValues.L,
    );
    expect(state.gameOver).toBe(false);
  });
});
