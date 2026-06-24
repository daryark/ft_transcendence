import { describe, expect, test } from '@jest/globals';
import { ConfigPatchSchema } from '../../game/config/config.schema';
import { applyConfigPatch, createConfig } from '../../game/config/configBase';

describe('solo config validation and patching', () => {
  test('accepts valid solo config patch', () => {
    const parsed = ConfigPatchSchema.safeParse({
      gameConfig: {
        general: {
          boardWidth: 12,
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  test('rejects invalid solo board dimensions', () => {
    const parsed = ConfigPatchSchema.safeParse({
      gameConfig: {
        general: {
          boardWidth: 99,
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  test('rejects invalid config patch', () => {
    const parsed = ConfigPatchSchema.safeParse({
      gameConfig: {
        boardWidth: 12,
      },
    });

    expect(parsed.success).toBe(false);
  });

  test('applyConfigPatch deep-merges patch without mutating base config', () => {
    const base = createConfig('solo');
    const patched = applyConfigPatch(base, {
      gameConfig: {
        general: {
          boardWidth: 12,
        },
      },
    });

    expect(patched.gameConfig.general.boardWidth).toBe(12);
    expect(base.gameConfig.general.boardWidth).toBe(10);
    expect(patched.gameConfig.general.boardHeight).toBe(base.gameConfig.general.boardHeight);
  });
});
