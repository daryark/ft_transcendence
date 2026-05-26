import { describe, expect, jest, test } from '@jest/globals';
import createModeService from '../../game/services/modeService';

describe('ModeService solo registry flow', () => {
  test('join calls solo handler and returns its result', () => {
    const result = { id: 'ROOM1', status: 'lobby', players: new Map() };
    const solo = jest.fn(() => result);
    const roomService: any = {};
    const playerService: any = {};
    const socket: any = { emit: jest.fn() };
    const service = createModeService({ modes: { solo }, roomService, playerService });

    expect(service.join('solo', socket, {})).toBe(result);
    expect(solo).toHaveBeenCalledWith(socket, { roomService, playerService }, {});
  });

  test('join emits INVALID_MODE when non-solo mode is shadowed', () => { //->only solo, while shadowed other modes
    const socket: any = { emit: jest.fn() };
    const service = createModeService({ modes: {}, roomService: {} as any, playerService: {} as any });

    service.join('quickplay', socket, {});

    expect(socket.emit).toHaveBeenCalledWith('server:error', { reason: 'INVALID_MODE' });
  });
});
