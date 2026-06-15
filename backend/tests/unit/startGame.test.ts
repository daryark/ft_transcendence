import { afterEach, describe, expect, jest, test } from '@jest/globals';
import startGame from '../../game/domain/match/startGame';
import { createConfig } from '../../game/config/configBase';
import type Room from '../../game/domain/room';
import type { RoomId } from '../../game/domain/room';
import type { UserId } from '../../auth/identity';

function createRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'R123' as RoomId,
    status: 'lobby',
    players: new Map(),
    state: null,
    engine: null,
    ...createConfig('solo'),
    ...overrides,
  };
}

describe('startGame solo flow', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes state, engine and broadcasts game:start', () => {
    jest.useFakeTimers();
    const room = createRoom();
    const roomService: any = { broadcast: jest.fn() };

    startGame(room, roomService);

    expect(room.status).toBe('playing');
    expect(room.state).toBeDefined();
    expect(room.state?.rows).toBe(20);
    expect(room.state?.cols).toBe(10);
    expect(room.engine).toBeDefined();
    expect(roomService.broadcast).toHaveBeenCalledWith(room.id, 'game:start', {
      roomId: room.id,
      state: room.state,
      config: room.gameConfig,
    });

    room.match?.stop();
    room.engine?.stop();
  });

  test('does nothing if room already playing', () => {
    const room = createRoom({ status: 'playing' });
    const roomService: any = { broadcast: jest.fn() };

    startGame(room, roomService);

    expect(roomService.broadcast).not.toHaveBeenCalled();
    expect(room.state).toBeNull();
    expect(room.engine).toBeNull();
  });

  test('restarts an ended room with a fresh state and the same room id', () => {
    jest.useFakeTimers();
    const room = createRoom({
      status: 'ended',
      state: {
        board: Array.from({ length: 20 }, () => Array(10).fill(1)),
        buffer: Array.from({ length: 20 }, () => Array(10).fill(0)),
        current: { type: 'I', shape: [[1, 1, 1, 1]], x: 3, y: 0 },
        next: [],
        hold: null,
        canHold: false,
        rows: 20,
        cols: 10,
        gameOver: true,
        score: 9999,
        lines: 40,
        piecesPlaced: 100,
        round: 4,
        startedAt: 1,
        update: {
          score: 9999,
          lines: 40,
          piecesPlaced: 100,
          elapsedMs: 1000,
          remainingMs: 0,
          piecesPerSecond: 100,
          round: 4,
          serverNow: 1001,
          objective: {
            type: 'lines',
            current: 40,
            target: 40,
            remaining: 0,
            complete: true,
          },
        },
      },
    });
    const originalRoomId = room.id;
    const roomService: any = { broadcast: jest.fn() };

    startGame(room, roomService);

    expect(room.id).toBe(originalRoomId);
    expect(room.status).toBe('playing');
    expect(room.state).toMatchObject({
      score: 0,
      lines: 0,
      round: 1,
      gameOver: false,
      hold: null,
      canHold: true,
    });
    expect(room.state?.board.flat().every(cell => cell === 0)).toBe(true);

    room.match?.stop();
  });

  test.each([
    ['anonymous', false],
    ['registered', true],
  ] as const)(
    'game:end sends the correct result for a %s player',
    async (identityType, expectsProgression) => {
      jest.useFakeTimers();
      const player = {
        id: 'user-1' as UserId,
        socketId: 'socket-1',
        connected: true,
        joinedAt: Date.now(),
        ...(identityType === 'registered'
          ? { profile: { nickname: 'Player', level: 1, xp: 0 } }
          : {}),
      };
      const room = createRoom({
        players: new Map([[player.id, player]]),
      });
      const roomService: any = { broadcast: jest.fn() };

      startGame(room, roomService);
      room.state!.lines = 40;
      room.match!.evaluate(room.state!);
      await Promise.resolve();

      const gameEndCall = roomService.broadcast.mock.calls.find(
        ([, event]: [string, string]) => event === 'game:end',
      );
      expect(gameEndCall).toBeDefined();
      expect(gameEndCall[2].roomId).toBe(room.id);
      expect(gameEndCall[2].result.stats).toBeDefined();

      if (expectsProgression) {
        expect(gameEndCall[2].result.progression).toEqual([
          expect.objectContaining({
            playerId: player.id,
            xpDelta: 100,
            level: 2,
            xp: 0,
          }),
        ]);
      } else {
        expect(gameEndCall[2].result).not.toHaveProperty('progression');
      }

      room.match?.stop();
    },
  );
});
