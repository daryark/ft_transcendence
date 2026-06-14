import { describe, expect, jest, test } from '@jest/globals';
import RoomService from '../../game/services/roomService';
import joinCustom, {
  removeCustomRoomParticipant,
} from '../../game/domain/mode/custom/index.js';

function createIo() {
  const roomEmitter = { emit: jest.fn() };
  return {
    roomEmitter,
    to: jest.fn(() => roomEmitter),
  };
}

function createSocket(player) {
  return {
    data: {
      identity: {
        id: player.id,
        type: player.identityType ?? 'anonymous',
      },
    },
    emit: jest.fn(),
    join: jest.fn(),
    removeAllListeners: jest.fn(),
    on: jest.fn(),
  };
}

function createPlayer(id, identityType = 'anonymous') {
  return {
    id,
    socketId: `socket-${id}`,
    identityType,
    connected: true,
    joinedAt: Date.now(),
    ...(identityType === 'registered'
      ? {
          profile: {
            nickname: `User ${id}`,
            level: 1,
            xp: 0,
          },
        }
      : {}),
  };
}

function createPlayerService(players) {
  return {
    get: jest.fn((playerId) => players.get(playerId)),
  };
}

function getLastRoomUpdate(io) {
  const calls = io.roomEmitter.emit.mock.calls.filter(
    ([event]) => event === 'room:update',
  );

  return calls.at(-1)?.[1];
}

describe('custom room lifecycle', () => {
  test('moves private room host to the next player when host leaves', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host');
    const nextPlayer = createPlayer('next');
    const players = new Map([
      [host.id, host],
      [nextPlayer.id, nextPlayer],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: false, roomName: 'Private' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(nextPlayer), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    removeCustomRoomParticipant(roomService, room.id, host.id, 'player');

    expect(roomService.getRoom(room.id)).toBe(room);
    expect(getLastRoomUpdate(io).players).toEqual([
      expect.objectContaining({ id: nextPlayer.id, isHost: true }),
    ]);
  });

  test('moves public room host only to a registered remaining player', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host', 'registered');
    const anonymous = createPlayer('anon');
    const registered = createPlayer('registered', 'registered');
    const players = new Map([
      [host.id, host],
      [anonymous.id, anonymous],
      [registered.id, registered],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: true, roomName: 'Public' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(anonymous), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    joinCustom(createSocket(registered), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    removeCustomRoomParticipant(roomService, room.id, host.id, 'player');

    const update = getLastRoomUpdate(io);
    expect(update.players.find((player) => player.id === anonymous.id).isHost).toBe(false);
    expect(update.players.find((player) => player.id === registered.id).isHost).toBe(true);
  });

  test('shows wins over games played for players in the room', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const winner = createPlayer('winner');
    const loser = createPlayer('loser');
    const players = new Map([
      [winner.id, winner],
      [loser.id, loser],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(winner), { roomService, playerService }, {
      roomConfig: { public: false, roomName: 'Private' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(loser), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    room.status = 'playing';
    room.engine = {
      playerEngines: new Map([
        [
          winner.id,
          {
            room: {
              status: 'playing',
              state: { gameOver: false },
            },
            engine: { stop: jest.fn() },
          },
        ],
        [
          loser.id,
          {
            room: {
              status: 'playing',
              state: { gameOver: false },
            },
            engine: { stop: jest.fn() },
          },
        ],
      ]),
      eliminatedPlayerIds: new Set(),
      stop: jest.fn(),
    };

    removeCustomRoomParticipant(roomService, room.id, loser.id, 'player');

    const update = getLastRoomUpdate(io);
    expect(update.players).toEqual([
      expect.objectContaining({
        id: winner.id,
        matchWins: 1,
        matchTotalGames: 1,
      }),
    ]);
  });
});
