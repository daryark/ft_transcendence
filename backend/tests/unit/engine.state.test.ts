import { describe, expect, test } from '@jest/globals';
import { createFigure } from '../../game/domain/engine/figures';
import { initGame } from '../../game/domain/engine/state';

describe('engine state initialization', () => {
  test('createFigure centers figure at spawn y', () => {
    const figure = createFigure('O', 10);

    expect(figure.type).toBe('O');
    expect(figure.x).toBe(4);
    expect(figure.y).toBe(-2);
  });

  test('initGame creates playable solo state', () => {
    const state = initGame(20, 10, 3);

    expect(state.board).toHaveLength(20);
    expect(state.board[0]).toHaveLength(10);
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
});
