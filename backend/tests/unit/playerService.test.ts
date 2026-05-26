import { describe, expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import PlayerService from '../../game/services/playerService';
import type Player from '../../game/domain/player';
import type { UserId } from '../../auth/identity';
import type { RoomId } from '../../game/domain/room';

function player(id = 'user-1'): Player {
  return {
    id: id as UserId,
    socketId: `socket-${id}`,
    connected: true,
    joinedAt: 100,
  };
}

describe('PlayerService solo player session flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('create validates and stores player', () => {
    const service = new PlayerService();
    const created = service.create(player());

    expect(service.get(created.id)).toBe(created);
  });

  test('create rejects invalid player shape', () => {
    const service = new PlayerService();

    expect(() => service.create({ id: '', socketId: '', connected: true, joinedAt: -1 } as Player)).toThrow();
  });

  test('update mutates existing player object so room references stay valid', () => {
    const service = new PlayerService();
    const created = service.create(player());
    const sameReference = service.get(created.id);

    const updated = service.update(created.id, { roomId: 'ROOM1' as RoomId, role: 'player' });

    expect(updated).toBe(sameReference);
    expect(sameReference?.roomId).toBe('ROOM1');
    expect(sameReference?.role).toBe('player');
  });

  test('markDisconnected marks player and expires after 30 seconds', () => {
    const service = new PlayerService();
    const created = service.create(player());
    const expired = jest.fn();

    service.markDisconnected(created.id, expired);

    expect(created.connected).toBe(false);
    expect(created.disconnectedAt).toEqual(expect.any(Number));

    jest.advanceTimersByTime(29_999);
    expect(expired).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledWith(created);
    expect(service.get(created.id)).toBeUndefined();
  });

  test('markConnected clears reconnect timeout and keeps same object', () => {
    const service = new PlayerService();
    const created = service.create(player());
    const expired = jest.fn();

    service.markDisconnected(created.id, expired);
    const reconnected = service.markConnected(created.id, 'socket-new');
    jest.advanceTimersByTime(30_000);

    expect(reconnected).toBe(created);
    expect(created.connected).toBe(true);
    expect(created.socketId).toBe('socket-new');
    expect(created.disconnectedAt).toBeUndefined();
    expect(expired).not.toHaveBeenCalled();
    expect(service.get(created.id)).toBe(created);
  });

  test('delete removes player and clears pending reconnect timeout', () => {
    const service = new PlayerService();
    const created = service.create(player());
    const expired = jest.fn();

    service.markDisconnected(created.id, expired);
    service.delete(created.id);
    jest.advanceTimersByTime(30_000);

    expect(expired).not.toHaveBeenCalled();
    expect(service.get(created.id)).toBeUndefined();
  });
});
