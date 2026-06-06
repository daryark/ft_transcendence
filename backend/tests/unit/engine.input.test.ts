import { describe, expect, test } from '@jest/globals';
import { inputTypes, isInput } from '../../game/domain/engine/input';

describe('engine input validation', () => {
  test('accepts every declared input type', () => {
    for (const type of inputTypes) {
      expect(isInput({ type })).toBe(true);
      expect(isInput({ type, phase: 'press' })).toBe(true);
      expect(isInput({ type, phase: 'release' })).toBe(true);
      expect(isInput({ type, phase: 'press', repeat: true })).toBe(true);
    }
  });

  test('rejects invalid runtime inputs', () => {
    expect(isInput({ type: 'teleport' })).toBe(false);
    expect(isInput({})).toBe(false);
    expect(isInput(null)).toBe(false);
    expect(isInput('left')).toBe(false);
    expect(isInput({ type: 'left', phase: 'repeat' })).toBe(false);
    expect(isInput({ type: 'left', repeat: 'yes' })).toBe(false);
  });
});
