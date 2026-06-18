import { describe, expect, jest, test } from '@jest/globals';
import RoomService from '../../game/services/roomService';
import joinCustom, {
  removeCustomRoomParticipant,
  switchCustomRoomRole,
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

  test('lets players join a running custom room as waiting players for the next game', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host');
    const activeOpponent = createPlayer('active');
    const waitingPlayer = createPlayer('waiting');
    const players = new Map([
      [host.id, host],
      [activeOpponent.id, activeOpponent],
      [waitingPlayer.id, waitingPlayer],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: false, roomName: 'Private' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(activeOpponent), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    room.status = 'playing';
    room.engine = {
      playerEngines: new Map([
        [host.id, { room: { status: 'playing', state: { gameOver: false } } }],
        [activeOpponent.id, { room: { status: 'playing', state: { gameOver: false } } }],
      ]),
      eliminatedPlayerIds: new Set(),
      stop: jest.fn(),
    };

    const waitingSocket = createSocket(waitingPlayer);
    joinCustom(waitingSocket, { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    expect(room.players.has(waitingPlayer.id)).toBe(false);
    expect(room.waitingPlayers.has(waitingPlayer.id)).toBe(true);
    expect(waitingSocket.data.role).toBe('player');
    expect(getLastRoomUpdate(io).players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: waitingPlayer.id }),
      ]),
    );
  });

  test('does not turn an intentional spectator into a waiting player on running room rejoin', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host');
    const activeOpponent = createPlayer('active');
    const spectator = createPlayer('spectator');
    const players = new Map([
      [host.id, host],
      [activeOpponent.id, activeOpponent],
      [spectator.id, spectator],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: false, roomName: 'Private' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(activeOpponent), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    joinCustom(createSocket(spectator), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    switchCustomRoomRole(roomService, room.id, spectator.id, 'spectator');

    room.status = 'playing';
    room.engine = {
      playerEngines: new Map([
        [host.id, { room: { status: 'playing', state: { gameOver: false } } }],
        [activeOpponent.id, { room: { status: 'playing', state: { gameOver: false } } }],
      ]),
      eliminatedPlayerIds: new Set(),
      stop: jest.fn(),
    };

    const spectatorSocket = createSocket(spectator);
    joinCustom(spectatorSocket, { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    expect(room.waitingPlayers?.has(spectator.id)).toBe(false);
    expect(room.players.has(spectator.id)).toBe(false);
    expect(room.spectators.has(spectator.id)).toBe(true);
    expect(spectatorSocket.data.role).toBe('spectator');
    expect(getLastRoomUpdate(io).players.filter((player) => player.id === spectator.id)).toHaveLength(1);
  });

  test('keeps a private room and makes the first spectator host when the last player leaves', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host');
    const spectator = createPlayer('spectator');
    const players = new Map([
      [host.id, host],
      [spectator.id, spectator],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: false, roomName: 'Private' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(spectator), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    switchCustomRoomRole(roomService, room.id, spectator.id, 'spectator');

    removeCustomRoomParticipant(roomService, room.id, host.id, 'player');

    expect(roomService.getRoom(room.id)).toBe(room);
    expect(room.status).toBe('lobby');
    expect(getLastRoomUpdate(io).players).toEqual([
      expect.objectContaining({
        id: spectator.id,
        role: 'spectator',
        isHost: true,
      }),
    ]);
  });

  test('keeps a public spectator room hostless until a registered player joins', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host', 'registered');
    const spectator = createPlayer('spectator');
    const registered = createPlayer('registered', 'registered');
    const players = new Map([
      [host.id, host],
      [spectator.id, spectator],
      [registered.id, registered],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: true, roomName: 'Public' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(spectator), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    switchCustomRoomRole(roomService, room.id, spectator.id, 'spectator');

    removeCustomRoomParticipant(roomService, room.id, host.id, 'player');

    expect(roomService.getRoom(room.id)).toBe(room);
    expect(getLastRoomUpdate(io).players).toEqual([
      expect.objectContaining({
        id: spectator.id,
        role: 'spectator',
        isHost: false,
      }),
    ]);

    joinCustom(createSocket(registered), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    expect(getLastRoomUpdate(io).players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: registered.id,
          role: 'player',
          isHost: true,
        }),
        expect.objectContaining({
          id: spectator.id,
          role: 'spectator',
          isHost: false,
        }),
      ]),
    );
  });

  test('keeps a registered public host badge when the host switches to spectator while players remain', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host', 'registered');
    const player = createPlayer('player');
    const players = new Map([
      [host.id, host],
      [player.id, player],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: true, roomName: 'Public' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(player), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });

    switchCustomRoomRole(roomService, room.id, host.id, 'spectator');

    expect(getLastRoomUpdate(io).players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: host.id,
          role: 'spectator',
          isHost: true,
        }),
        expect.objectContaining({
          id: player.id,
          role: 'player',
          isHost: false,
        }),
      ]),
    );
  });

  test('removes a public spectator host from the room when that host leaves', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host', 'registered');
    const player = createPlayer('player');
    const players = new Map([
      [host.id, host],
      [player.id, player],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: true, roomName: 'Public' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(player), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    switchCustomRoomRole(roomService, room.id, host.id, 'spectator');

    removeCustomRoomParticipant(roomService, room.id, host.id, 'spectator');

    expect(getLastRoomUpdate(io).players).toEqual([
      expect.objectContaining({
        id: player.id,
        role: 'player',
        isHost: false,
      }),
    ]);
  });

  test('removes a spectator host even if leave is called with stale player role', () => {
    const io = createIo();
    const roomService = new RoomService(io);
    const host = createPlayer('host');
    const player = createPlayer('player');
    const players = new Map([
      [host.id, host],
      [player.id, player],
    ]);
    const playerService = createPlayerService(players);

    joinCustom(createSocket(host), { roomService, playerService }, {
      roomConfig: { public: false, roomName: 'Private' },
    });
    const room = Array.from(roomService['rooms'].values())[0];
    joinCustom(createSocket(player), { roomService, playerService }, {
      roomConfig: { roomName: `JOIN:${room.id}` },
    });
    switchCustomRoomRole(roomService, room.id, host.id, 'spectator');

    removeCustomRoomParticipant(roomService, room.id, host.id, 'player');

    expect(room.spectators.has(host.id)).toBe(false);
    expect(getLastRoomUpdate(io).players).toEqual([
      expect.objectContaining({
        id: player.id,
        role: 'player',
        isHost: true,
      }),
    ]);
  });
});
