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

  test('removePlayer clears player room fields without deleting the room', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('solo'));
    const player = createPlayer();

    service.addPlayer(room.id, player);
    service.removePlayer(room.id, player.id);

    expect(player.roomId).toBeUndefined();
    expect(player.role).toBeUndefined();
    expect(room.players.size).toBe(0);
    expect(service.getRoom(room.id)).toBe(room);
    expect(service.isEmpty(room.id)).toBe(true);
  });

  test('removeSpectator clears spectator room fields without deleting the room', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('quickplay'));
    const spectator = createPlayer();

    service.addSpectator(room.id, spectator);
    service.removeSpectator(room.id, spectator.id);

    expect(spectator.roomId).toBeUndefined();
    expect(spectator.role).toBeUndefined();
    expect(room.spectators?.size).toBe(0);
    expect(service.getRoom(room.id)).toBe(room);
  });

  test('deleteRoom clears room object, spectators and stops engine before deleting room', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('quickplay'));
    const spectator = createPlayer('user-2');
    const stop = jest.fn();
    const roomId = room.id;

    service.addSpectator(roomId, spectator);
    room.state = {} as any;
    room.engine = { stop, pushInput: jest.fn() };

    service.deleteRoom(roomId);

    expect(spectator.roomId).toBeUndefined();
    expect(spectator.role).toBeUndefined();
    expect(room.status).toBe('ended');
    expect(room.state).toBeNull();
    expect(room.engine).toBeNull();
    expect(room.players.size).toBe(0);
    expect(room.spectators?.size).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.getRoom(roomId)).toBeUndefined();
  });

  test('clearRooms cleans each room object before clearing the service map', () => {
    const service = new RoomService(createIo() as any);
    const room = service.createRoom(createConfig('quickplay'));
    const player = createPlayer('user-1');
    const spectator = createPlayer('user-2');
    const stop = jest.fn();
    const roomId = room.id;

    service.addPlayer(roomId, player);
    service.addSpectator(roomId, spectator);
    room.state = {} as any;
    room.engine = { stop, pushInput: jest.fn() };

    service.clearRooms();

    expect(player.roomId).toBeUndefined();
    expect(player.role).toBeUndefined();
    expect(spectator.roomId).toBeUndefined();
    expect(spectator.role).toBeUndefined();
    expect(room.status).toBe('ended');
    expect(room.state).toBeNull();
    expect(room.engine).toBeNull();
    expect(room.players.size).toBe(0);
    expect(room.spectators?.size).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(service.getRoom(roomId)).toBeUndefined();
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
