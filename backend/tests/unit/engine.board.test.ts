import { describe, expect, test } from '@jest/globals';
import { createBoardHeight, createBoardWidth, createEmptyBoard } from '../../game/domain/engine/board';

describe('engine board helpers', () => {
  test('creates valid board dimensions and empty board', () => {
    const rows = createBoardHeight(20);
    const cols = createBoardWidth(10);

    const board = createEmptyBoard(rows, cols);

    expect(board).toHaveLength(20);
    expect(board[0]).toHaveLength(10);
    expect(board.flat().every(cell => cell === 0)).toBe(true);
  });

  test('rejects invalid board width and height', () => {
    expect(() => createBoardWidth(3)).toThrow('Invalid board width');
    expect(() => createBoardWidth(21)).toThrow('Invalid board width');
    expect(() => createBoardHeight(3)).toThrow('Invalid board height');
    expect(() => createBoardHeight(41)).toThrow('Invalid board height');
  });
});
