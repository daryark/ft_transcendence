import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { createFigure } from '../../game/domain/engine/figures';
import { buildGameStats, initGame } from '../../game/domain/engine/state';

describe('engine state initialization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createFigure centers figure at spawn y', () => {
    const figure = createFigure('O', 10);

    expect(figure.type).toBe('O');
    expect(figure.x).toBe(4);
    expect(figure.y).toBe(-3);
  });

  test('initGame creates playable solo state', () => {
    const state = initGame(20, 10, 3);

    expect(state.board).toHaveLength(20);
    expect(state.board[0]).toHaveLength(10);
    expect(state.buffer).toHaveLength(20);
    expect(state.buffer.flat().every(cell => cell === 0)).toBe(true);
    expect(state.current).toBeDefined();
    expect(state.next.length).toBeGreaterThan(0);
    expect(state.hold).toBeNull();
    expect(state.canHold).toBe(true);
    expect(state.rows).toBe(20);
    expect(state.cols).toBe(10);
    expect(state.gameOver).toBe(false);
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.round).toBe(3);
    expect(state.startedAt).toEqual(expect.any(Number));
  });

  test('buildGameStats reports server-authoritative objective progress', () => {
    const state = initGame(20, 10, 1, 1_000);
    state.lines = 12;
    state.score = 800;
    state.piecesPlaced = 30;

    const stats = buildGameStats(state, {
      winCondition: 'lines',
      linesToClear: 40,
      key: 'time',
      allowRetry: false,
      stock: 0,
    });

    expect(stats).toMatchObject({
      score: 800,
      lines: 12,
      piecesPlaced: 30,
      objective: {
        type: 'lines',
        current: 12,
        target: 40,
        remaining: 28,
        complete: false,
      },
    });
    expect(stats.serverNow).toEqual(expect.any(Number));
    expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  test('buildGameStats calculates PPS from locked pieces and server time', () => {
    const state = initGame(20, 10, 1, 1_000);
    state.piecesPlaced = 25;
    jest.spyOn(Date, 'now').mockReturnValue(11_000);

    const stats = buildGameStats(state);

    expect(stats.elapsedMs).toBe(10_000);
    expect(stats.piecesPerSecond).toBe(2.5);
  });

  test('buildGameStats keeps elapsed time at zero before countdown ends', () => {
    const futureStart = Date.now() + 4_500;
    const state = initGame(20, 10, 1, futureStart);

    const stats = buildGameStats(state, {
      winCondition: 'time',
      timeLimit: 120,
      key: 'score',
      allowRetry: false,
      stock: 0,
    });

    expect(stats.elapsedMs).toBe(0);
    expect(stats.remainingMs).toBe(120_000);
  });
});
