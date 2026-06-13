import { describe, expect, test } from '@jest/globals';
import { clearLines, collision, moveFigure, rotate } from '../../game/domain/engine/logic';
import type { Figure } from '../../game/domain/engine/figures';

describe('engine logic helpers', () => {
  test('moveFigure returns moved copy', () => {
    const figure: Figure = { type: 'O', shape: [[1, 1], [1, 1]], x: 4, y: 0 };

    expect(moveFigure(figure, -1, 2)).toEqual({ ...figure, x: 3, y: 2 });
    expect(figure).toEqual({ type: 'O', shape: [[1, 1], [1, 1]], x: 4, y: 0 });
  });

  test('rotate rotates matrix clockwise', () => {
    expect(rotate([
      [1, 0],
      [1, 1],
    ])).toEqual([
      [1, 1],
      [1, 0],
    ]);
  });

  test('collision detects walls, floor and occupied cells', () => {
    const board = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ];
    const figure: Figure = { type: 'O', shape: [[1]], x: 1, y: 1 };

    expect(collision(board, figure)).toBe(true);
    expect(collision(board, { ...figure, x: -1, y: 0 })).toBe(true);
    expect(collision(board, { ...figure, x: 0, y: 3 })).toBe(true);
    expect(collision(board, { ...figure, x: 0, y: 0 })).toBe(false);
  });

  test('collision checks occupied cells above the visible board', () => {
    const board = Array.from({ length: 3 }, () => Array(3).fill(0));
    const buffer = Array.from({ length: 4 }, () => Array(3).fill(0));
    buffer[1][1] = 1; // y = -3
    const figure: Figure = { type: 'O', shape: [[1]], x: 1, y: -3 };

    expect(collision(board, figure, buffer)).toBe(true);
    expect(collision(board, { ...figure, x: 2 }, buffer)).toBe(false);
  });

  test('clearLines clears filled rows and scores', () => {
    const result = clearLines([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);

    expect(result.cleared).toBe(2);
    expect(result.scoreAdd).toBe(300);
    expect(result.newBoard).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [1, 0, 1],
    ]);
    expect(result.newBuffer).toEqual([]);
  });
});
