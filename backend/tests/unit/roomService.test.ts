import { describe, expect, jest, test } from '@jest/globals';
import RoomService from '../../game/services/roomService';
import { createConfig } from '../../game/config/configBase';
import type Player from '../../game/domain/player';
import type { UserId } from '../../auth/identity';
import type { RoomId } from '../../game/domain/room';

function createIo() {
  const roomEmitter = { emit: jest.fn() };
  return {
    roomEmitter,
    to: jest.fn(() => roomEmitter),
  };
}

function createPlayer(id = 'user-1'): Player {
  return {
    id: id as UserId,
    socketId: `socket-${id}`,
    connected: true,
    joinedAt: Date.now(),
  };
}

describe('RoomService solo room flow', () => {
  test('creates a solo room with empty player map and no spectators', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));

    expect(room.status).toBe('lobby');
    expect(room.players).toBeInstanceOf(Map);
    expect(room.players.size).toBe(0);
    expect(room.spectators).toBeUndefined();
    expect(room.state).toBeNull();
    expect(room.engine).toBeNull();
    expect(service.getRoom(room.id)).toBe(room);
  });

  test('addPlayer stores the same player object and marks it as room player', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));
    const player = createPlayer();

    service.addPlayer(room.id, player);

    expect(room.players.get(player.id)).toBe(player);
    expect(player.roomId).toBe(room.id);
    expect(player.role).toBe('player');
  });

  test('addPlayer does not duplicate the same player', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));
    const player = createPlayer();

    service.addPlayer(room.id, player);
    service.addPlayer(room.id, player);

    expect(room.players.size).toBe(1);
  });

  test('removePlayer clears player room fields and deletes empty room', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));
    const player = createPlayer();

    service.addPlayer(room.id, player);
    service.removePlayer(room.id, player.id);

    expect(player.roomId).toBeUndefined();
    expect(service.getRoom(room.id)).toBeUndefined();
  });

  test('deleteRoom stops engine before deleting room', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));
    const stop = jest.fn();
    room.engine = { stop, pushInput: jest.fn() };

    service.deleteRoom(room.id);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.getRoom(room.id)).toBeUndefined();
  });

  test('broadcast emits to existing room id', () => {
    const io = createIo();
    const service = new RoomService(io as any);
    const room = service.createRoom(createConfig('solo'));
    const payload = { ok: true };

    service.broadcast(room.id, 'game:update', payload);

    expect(io.to).toHaveBeenCalledWith(room.id);
    expect(io.roomEmitter.emit).toHaveBeenCalledWith('game:update', payload);
  });

  test('getRoomState returns room id, status and player map', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));
    const player = createPlayer();
    service.addPlayer(room.id, player);

    expect(service.getRoomState(room.id)).toEqual({
      id: room.id,
      status: room.status,
      players: room.players,
    });
  });

  test('getRoomState returns null for missing room', () => {
    const service = new RoomService(createIo() as any);

    expect(service.getRoomState('NONE' as RoomId)).toBeNull();
  });
});
