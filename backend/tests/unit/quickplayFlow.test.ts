import { describe, expect, jest, test } from "@jest/globals";
import { join as joinQuickplay } from "../../game/domain/mode/quickplay";
import PlayerService from "../../game/services/playerService";
import RoomService from "../../game/services/roomService";

type TestSocket = {
  id: string;
  data: {
    identity: {
      id: string;
      type: "anonymous";
    };
  };
  emit: jest.Mock;
  join: jest.Mock;
};

function createIo() {
  const roomEmitter = { emit: jest.fn() };

  return {
    roomEmitter,
    emit: jest.fn(),
    to: jest.fn(() => roomEmitter),
  };
}

function createSocket(id: string, playerId: string): TestSocket {
  return {
    id,
    data: {
      identity: {
        id: playerId,
        type: "anonymous",
      },
    },
    emit: jest.fn(),
    join: jest.fn(),
  };
}

function createPlayerService() {
  const playerService = new PlayerService();

  playerService.create({
    id: "p1" as never,
    socketId: "s1",
    identityType: "anonymous",
    connected: true,
    joinedAt: Date.now(),
    profile: { nickname: "P1" },
  });
  playerService.create({
    id: "p2" as never,
    socketId: "s2",
    identityType: "anonymous",
    connected: true,
    joinedAt: Date.now(),
    profile: { nickname: "P2" },
  });

  return playerService;
}

describe("quickplay flow", () => {
  test("keeps the first starter waiting and starts when the second player joins", () => {
    const io = createIo();
    const roomService = new RoomService(io as never);
    const playerService = createPlayerService();
    const firstSocket = createSocket("s1", "p1");
    const secondSocket = createSocket("s2", "p2");

    const firstState = joinQuickplay(firstSocket as never, { roomService, playerService }, {
      gameConfig: {
        mode: "quickplay",
        modifiers: ["messier-garbage", "double-hole"],
      },
    });
    const room = firstState ? roomService.getRoom(firstState.id) : undefined;

    expect(room?.status).toBe("lobby");
    expect(room?.players.has("p1" as never)).toBe(true);
    expect(firstSocket.emit).toHaveBeenCalledWith(
      "room:update",
      expect.objectContaining({ players: 1, waitingFor: 2 }),
    );

    joinQuickplay(firstSocket as never, { roomService, playerService }, {});
    expect(room?.players.size).toBe(1);

    joinQuickplay(secondSocket as never, { roomService, playerService }, {});

    expect(room?.status).toBe("playing");
    expect(room?.players.has("p1" as never)).toBe(true);
    expect(room?.players.has("p2" as never)).toBe(true);
    expect(io.roomEmitter.emit).toHaveBeenCalledWith(
      "game:start",
      expect.objectContaining({
        roomId: room?.id,
        mode: "quickplay",
        players: expect.objectContaining({
          p1: expect.objectContaining({
            config: expect.objectContaining({
              modifiers: ["messier-garbage", "double-hole"],
            }),
          }),
        }),
      }),
    );
    expect(firstSocket.emit).not.toHaveBeenCalledWith(
      "server:error",
      expect.anything(),
    );
    expect(secondSocket.emit).not.toHaveBeenCalledWith(
      "server:error",
      expect.anything(),
    );

    room?.engine?.stop();
  });
});
