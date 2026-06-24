// @ts-nocheck
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import "../helpers/mockPrisma";

import customJoin, { startCustomRoom } from "../../game/domain/mode/custom";
import quickplayJoin, {
  joinQuickplayLobby,
  spectateQuickplay,
} from "../../game/domain/mode/quickplay";
import soloJoin from "../../game/domain/mode/solo";
import PlayerService from "../../game/services/playerService";
import RoomService from "../../game/services/roomService";
import { leaveRoomParticipant } from "../../game/services/roomLifecycleService";

type EmittedEvent = {
  room?: string;
  event: string;
  data: unknown;
};

type TestSocket = {
  id: string;
  data: {
    identity: {
      id: string | number;
      type: "anonymous" | "registered";
    };
    roomId?: string;
    role?: "player" | "spectator";
  };
  emit: jest.Mock;
  join: jest.Mock;
  on: jest.Mock;
  removeAllListeners: jest.Mock;
};

function createIo() {
  const events: EmittedEvent[] = [];

  return {
    events,
    emit: jest.fn((event: string, data: unknown) => {
      events.push({ event, data });
    }),
    to: jest.fn((room: string) => ({
      emit: jest.fn((event: string, data: unknown) => {
        events.push({ room, event, data });
      }),
    })),
  };
}

function createSocket(
  id: string,
  playerId: string | number,
  type: "anonymous" | "registered" = "anonymous",
): TestSocket {
  return {
    id,
    data: {
      identity: {
        id: playerId,
        type,
      },
    },
    emit: jest.fn(),
    join: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

function addPlayer(
  playerService: PlayerService,
  id: string | number,
  type: "anonymous" | "registered" = "anonymous",
) {
  return playerService.create({
    id: id as never,
    socketId: `socket-${id}`,
    identityType: type,
    connected: true,
    joinedAt: Date.now(),
    profile: {
      nickname: `PLAYER-${id}`,
      level: 1,
      xp: 0,
    },
  });
}

function createServices() {
  const io = createIo();

  return {
    io,
    playerService: new PlayerService(),
    roomService: new RoomService(io as never),
  };
}

function cleanupRooms(roomService: RoomService) {
  roomService.clearRooms();
}

describe("realtime multiplayer flow stress tests", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("keeps many custom rooms isolated while players, spectators, and interrupts happen in parallel", () => {
    const { io, playerService, roomService } = createServices();
    const sockets = Array.from({ length: 20 }, (_, index) => {
      const id = `u-${index + 1}`;
      const type = index % 5 === 0 || index % 3 === 0 ? "registered" : "anonymous";
      addPlayer(playerService, id, type);
      return createSocket(`s-${index + 1}`, id, type);
    });

    try {
      const roomIds: string[] = [];

      for (let roomIndex = 0; roomIndex < 4; roomIndex += 1) {
        const hostSocket = sockets[roomIndex * 5];
        const created = customJoin(
          hostSocket as never,
          { roomService, playerService },
          {
            roomConfig: {
              public: roomIndex % 2 === 0,
              roomName: `parallel ${roomIndex}`,
              maxPlayers: 4,
            },
          },
        );
        expect(created?.id).toBeDefined();
        roomIds.push(created!.id);

        for (let offset = 1; offset <= 3; offset += 1) {
          customJoin(
            sockets[roomIndex * 5 + offset] as never,
            { roomService, playerService },
            { roomConfig: { roomName: `JOIN:${created!.id}` } },
          );
        }

        customJoin(
          sockets[roomIndex * 5 + 4] as never,
          { roomService, playerService },
          { roomConfig: { roomName: `JOIN:${created!.id}` } },
        );
      }

      const rooms = roomIds.map((roomId) => roomService.getRoom(roomId as never));
      rooms.forEach((room, index) => {
        expect(room?.roomConfig.roomName).toBe(`PARALLEL ${index}`);
        expect(room?.players.size).toBe(4);
        expect(room?.spectators?.size).toBe(1);
        expect(room?.status).toBe("lobby");
      });

      for (const [index, roomId] of roomIds.entries()) {
        const hostId = sockets[index * 5].data.identity.id;
        const result = startCustomRoom(roomService, roomId, hostId);
        expect(result).toEqual({ ok: true });
      }

      rooms.forEach((room) => {
        expect(room?.status).toBe("playing");
        expect(room?.engine).toBeTruthy();
        expect(room?.engine?.playerEngines.size).toBe(4);
      });

      leaveRoomParticipant(
        roomService,
        roomIds[0],
        sockets[1].data.identity.id as never,
        "player",
      );
      leaveRoomParticipant(
        roomService,
        roomIds[1],
        sockets[9].data.identity.id as never,
        "spectator",
      );
      leaveRoomParticipant(
        roomService,
        roomIds[2],
        sockets[10].data.identity.id as never,
        "player",
      );

      expect(roomService.getRoom(roomIds[0] as never)?.players.size).toBe(3);
      expect(roomService.getRoom(roomIds[1] as never)?.spectators?.size).toBe(0);
      expect(roomService.getRoom(roomIds[2] as never)?.players.size).toBe(3);
      expect(roomService.getRoom(roomIds[3] as never)?.players.size).toBe(4);
      expect(io.events.filter((event) => event.event === "game:end").length).toBe(0);
    } finally {
      cleanupRooms(roomService);
    }
  });

  test("keeps a custom waiting player isolated from a solo zen room and promotes them into the next custom game", () => {
    const { playerService, roomService } = createServices();
    const host = createSocket("host-socket", "host", "registered");
    const opponent = createSocket("opponent-socket", "opponent");
    const waiter = createSocket("waiter-socket", "waiter");

    addPlayer(playerService, "host", "registered");
    addPlayer(playerService, "opponent");
    addPlayer(playerService, "waiter");

    try {
      const customState = customJoin(host as never, { roomService, playerService }, {
        roomConfig: { roomName: "custom waiting", public: true },
      });
      expect(customState?.id).toBeDefined();
      const customRoomId = customState!.id;

      customJoin(
        opponent as never,
        { roomService, playerService },
        { roomConfig: { roomName: `JOIN:${customRoomId}` } },
      );
      expect(startCustomRoom(roomService, customRoomId, "host")).toEqual({ ok: true });
      expect(roomService.getRoom(customRoomId as never)?.status).toBe("playing");

      customJoin(
        waiter as never,
        { roomService, playerService },
        { roomConfig: { roomName: `JOIN:${customRoomId}` } },
      );
      const customRoom = roomService.getRoom(customRoomId as never)!;
      expect(customRoom.players.has("waiter" as never)).toBe(false);
      expect(customRoom.waitingPlayers?.has("waiter" as never)).toBe(true);

      const soloSocket = createSocket("waiter-zen-socket", "waiter");
      soloJoin(
        soloSocket as never,
        { roomService, playerService },
        { gameConfig: { mode: "solo", preset: "zen" } },
      );
      const zenRoomId = soloSocket.data.roomId!;
      expect(zenRoomId).toBeDefined();
      expect(zenRoomId).not.toBe(customRoomId);
      expect(roomService.getRoom(zenRoomId as never)?.gameConfig.mode).toBe("solo");
      expect(roomService.getRoom(customRoomId as never)?.waitingPlayers?.has("waiter" as never)).toBe(true);

      leaveRoomParticipant(roomService, zenRoomId, "waiter" as never, "player");
      expect(roomService.getRoom(zenRoomId as never)).toBeUndefined();
      expect(roomService.getRoom(customRoomId as never)?.waitingPlayers?.has("waiter" as never)).toBe(true);

      leaveRoomParticipant(roomService, customRoomId, "opponent" as never, "player");
      expect(roomService.getRoom(customRoomId as never)?.status).toBe("lobby");
      expect(roomService.getRoom(customRoomId as never)?.players.has("waiter" as never)).toBe(true);
      expect(roomService.getRoom(customRoomId as never)?.waitingPlayers?.size ?? 0).toBe(0);

      expect(startCustomRoom(roomService, customRoomId, "host")).toEqual({ ok: true });
      const restartedRoom = roomService.getRoom(customRoomId as never)!;
      expect(restartedRoom.status).toBe("playing");
      expect(restartedRoom.engine?.playerEngines.has("waiter")).toBe(true);
    } finally {
      cleanupRooms(roomService);
    }
  });

  test("supports a 10-player quickplay pool with spectators, individual modifiers, and clean participant exits", () => {
    const { io, playerService, roomService } = createServices();
    const playerSockets = Array.from({ length: 10 }, (_, index) => {
      const id = `qp-${index + 1}`;
      addPlayer(playerService, id, index % 2 === 0 ? "registered" : "anonymous");
      return createSocket(`qp-s-${index + 1}`, id, index % 2 === 0 ? "registered" : "anonymous");
    });
    const spectatorSockets = Array.from({ length: 5 }, (_, index) => {
      const id = `spec-${index + 1}`;
      addPlayer(playerService, id);
      return createSocket(`spec-s-${index + 1}`, id);
    });

    try {
      playerSockets.forEach((socket, index) => {
        quickplayJoin(
          socket as never,
          { roomService, playerService },
          {
            gameConfig: {
              mode: "quickplay",
              modifiers:
                index % 2 === 0
                  ? ["messier-garbage", "double-hole"]
                  : ["no-hold"],
            },
          },
        );
      });

      const room = roomService.findRoom((candidate) => candidate.gameConfig.mode === "quickplay")!;
      expect(room).toBeDefined();
      expect(room.status).toBe("playing");
      expect(room.players.size).toBe(10);
      expect(room.engine?.playerEngines.size).toBe(10);

      spectatorSockets.slice(0, 3).forEach((socket) => {
        joinQuickplayLobby(socket as never, { roomService, playerService });
      });
      spectatorSockets.slice(3).forEach((socket) => {
        spectateQuickplay(socket as never, { roomService, playerService });
      });

      expect(room.spectators?.size).toBe(5);
      expect(room.players.size).toBe(10);

      const payload = io.events.find(
        (event) => event.room === room.id && event.event === "game:start",
      )?.data as
        | { players?: Record<string, { config?: { modifiers?: string[] } }> }
        | undefined;
      expect(payload?.players?.["qp-1"]?.config?.modifiers).toEqual([
        "messier-garbage",
        "double-hole",
      ]);
      expect(payload?.players?.["qp-2"]?.config?.modifiers).toEqual(["no-hold"]);

      for (let index = 0; index < 9; index += 1) {
        leaveRoomParticipant(
          roomService,
          room.id,
          playerSockets[index].data.identity.id as never,
          "player",
        );
      }

      expect(room.players.size).toBe(1);
      expect(room.spectators?.size).toBe(5);
      expect(room.status).toBe("playing");

      leaveRoomParticipant(
        roomService,
        room.id,
        playerSockets[9].data.identity.id as never,
        "player",
      );

      expect(room.players.size).toBe(0);
      expect(room.spectators?.size).toBe(5);
      expect(room.status).toBe("lobby");
      expect(room.engine).toBeNull();
      expect(room.state).toBeNull();

      for (const socket of spectatorSockets) {
        leaveRoomParticipant(
          roomService,
          room.id,
          socket.data.identity.id as never,
          "spectator",
        );
      }

      expect(room.players.size).toBe(0);
      expect(room.spectators?.size).toBe(0);
      expect(roomService.getRoom(room.id)).toBeDefined();
    } finally {
      cleanupRooms(roomService);
    }
  });

  test("does not leak room membership across disconnect-style cleanup and replacement joins", () => {
    const { playerService, roomService } = createServices();
    const firstSocket = createSocket("first-socket", "same-user", "registered");
    const replacementSocket = createSocket("replacement-socket", "same-user", "registered");
    const secondSocket = createSocket("second-socket", "second-user", "registered");

    addPlayer(playerService, "same-user", "registered");
    addPlayer(playerService, "second-user", "registered");

    try {
      const firstRoomState = customJoin(
        firstSocket as never,
        { roomService, playerService },
        { roomConfig: { roomName: "replace me", public: true } },
      );
      const firstRoomId = firstRoomState!.id;
      expect(roomService.getRoom(firstRoomId as never)?.players.size).toBe(1);

      leaveRoomParticipant(roomService, firstRoomId, "same-user" as never, "player");
      expect(roomService.getRoom(firstRoomId as never)).toBeUndefined();

      const secondRoomState = customJoin(
        replacementSocket as never,
        { roomService, playerService },
        { roomConfig: { roomName: "replacement", public: true } },
      );
      const secondRoomId = secondRoomState!.id;

      customJoin(
        secondSocket as never,
        { roomService, playerService },
        { roomConfig: { roomName: `JOIN:${secondRoomId}` } },
      );

      const room = roomService.getRoom(secondRoomId as never)!;
      expect(room.players.size).toBe(2);
      expect(Array.from(room.players.keys())).toEqual(["same-user", "second-user"]);
      expect(startCustomRoom(roomService, secondRoomId, "same-user")).toEqual({ ok: true });

      leaveRoomParticipant(roomService, secondRoomId, "same-user" as never, "player");
      leaveRoomParticipant(roomService, secondRoomId, "second-user" as never, "player");
      expect(roomService.getRoom(secondRoomId as never)).toBeUndefined();
    } finally {
      cleanupRooms(roomService);
    }
  });

  test("player service disconnect expiry removes non-league players immediately without leaving room references", () => {
    const { playerService, roomService } = createServices();
    const socket = createSocket("anon-socket", "anon-user");

    addPlayer(playerService, "anon-user");

    try {
      const state = customJoin(
        socket as never,
        { roomService, playerService },
        { roomConfig: { roomName: "disconnect cleanup", public: true } },
      );
      const roomId = state!.id;
      expect(roomService.getRoom(roomId as never)?.players.has("anon-user" as never)).toBe(true);

      const disconnected = playerService.markDisconnected(
        "anon-user" as never,
        (player) => {
          if (player.roomId) {
            leaveRoomParticipant(
              roomService,
              player.roomId,
              player.id,
              (player.role ?? "player") as never,
            );
          }
        },
        0,
      );

      expect(disconnected?.connected).toBe(false);
      expect(playerService.get("anon-user" as never)).toBeUndefined();
      expect(roomService.getRoom(roomId as never)).toBeUndefined();
    } finally {
      cleanupRooms(roomService);
    }
  });
});
