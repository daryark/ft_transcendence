import { describe, expect, jest, test } from '@jest/globals';
import joinSolo from '../../game/domain/mode/solo';
import { createConfig } from '../../game/config/configBase';
import type Player from '../../game/domain/player';
import type { UserId } from '../../auth/identity';
import type { RoomId } from '../../game/domain/room';

function createPlayer(): Player {
  return {
    id: 'user-1' as UserId,
    socketId: 'socket-1',
    connected: true,
    joinedAt: Date.now(),
  };
}

describe('solo mode join', () => {
  test('creates room, adds player object, joins socket and starts game', () => {
    const player = createPlayer();
    const socket: any = {
      id: player.socketId,
      data: { identity: { id: player.id, type: 'anonymous' } },
      join: jest.fn(),
    };

    const room = {
      id: 'ROOM1' as RoomId,
      status: 'lobby',
      players: new Map(),
      state: null,
      engine: null,
      ...createConfig('solo'),
    };

    const roomService: any = {
      createRoom: jest.fn(() => room),
      addPlayer: jest.fn(),
      getRoom: jest.fn(() => room),
      getRoomState: jest.fn(() => ({ id: room.id, status: 'playing', players: room.players })),
      broadcast: jest.fn(),
    };
    const playerService: any = {
      get: jest.fn(() => player),
    };

    const state = joinSolo(socket, { roomService, playerService }, {});

    expect(roomService.createRoom).toHaveBeenCalled();
    expect(roomService.addPlayer).toHaveBeenCalledWith(room.id, player);
    expect(socket.join).toHaveBeenCalledWith(room.id);
    expect(socket.data.roomId).toBe(room.id);
    expect(socket.data.role).toBe('player');
    expect(room.status).toBe('playing');
    expect(room.engine).toBeDefined();
    room.match?.stop();
    room.engine?.stop();
    expect(state).toEqual({ id: room.id, status: 'playing', players: room.players });
  });

  test('emits error and returns null when player is missing', () => {
    const socket: any = {
      id: 'socket-1',
      data: { identity: { id: 'user-1', type: 'anonymous' } },
      join: jest.fn(),
      emit: jest.fn(),
    };
    const roomService: any = {
      createRoom: jest.fn(() => ({
        id: 'ROOM1',
        status: 'lobby',
        players: new Map(),
        state: null,
        engine: null,
        ...createConfig('solo'),
      })),
      addPlayer: jest.fn(),
    };
    const playerService: any = {
      get: jest.fn(() => undefined),
    };

    const state = joinSolo(socket, { roomService, playerService }, {});

    expect(state).toBeNull();
    expect(socket.emit).toHaveBeenCalledWith('server:error', { reason: 'PLAYER_NOT_FOUND' });
    expect(roomService.addPlayer).not.toHaveBeenCalled();
  });
});
