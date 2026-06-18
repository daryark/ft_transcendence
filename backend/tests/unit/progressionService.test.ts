import { describe, expect, test } from "@jest/globals";
import type { UserId } from "../../auth/identity";
import { createConfig } from "../../game/config/configBase";
import { initGame } from "../../game/domain/engine/state";
import type Player from "../../game/domain/player";
import type Room from "../../game/domain/room";
import type { RoomId } from "../../game/domain/room";
import createProgressionService from "../../game/services/progressionService";

function createRoom(player: Player): Room {
  return {
    id: "ROOM1" as RoomId,
    status: "playing",
    players: new Map([[player.id, player]]),
    state: null,
    engine: null,
    match: null,
    ...createConfig("solo"),
  };
}

function createFortyLinesRoom(player: Player): Room {
  const room = createRoom(player);
  room.gameConfig.preset = "40Lines";
  room.gameConfig.objective.winCondition = "lines";
  room.gameConfig.objective.linesToClear = 40;
  return room;
}

describe("progressionService", () => {
  test("anonymous players receive no progression payload", () => {
    const player: Player = {
      id: "anonymous-1" as UserId,
      socketId: "socket-1",
      connected: true,
      joinedAt: Date.now(),
    };
    const room = createRoom(player);
    const service = createProgressionService(room);

    service.onMatchStart(room);
    const progression = service.onMatchEnd({
      room,
      state: initGame(20, 10, 1),
      reason: "objective_complete",
      completedRounds: 1,
      stockLeft: 0,
    });

    expect(progression).toEqual([]);
  });

  test("registered players receive 300 xp for completed 40 lines objective", () => {
    const player: Player = {
      id: "registered-1" as UserId,
      socketId: "socket-1",
      connected: true,
      joinedAt: Date.now(),
      profile: {
        nickname: "Player",
        level: 2,
        xp: 75,
      },
    };
    const room = createFortyLinesRoom(player);
    const service = createProgressionService(room);

    service.onMatchStart(room);
    const progression = service.onMatchEnd({
      room,
      state: initGame(20, 10, 1),
      reason: "objective_complete",
      completedRounds: 1,
      stockLeft: 0,
    });

    expect(progression).toEqual([
      expect.objectContaining({
        playerId: player.id,
        xpDelta: 300,
        level: 2,
        xp: 375,
      }),
    ]);
    expect(player.profile).toMatchObject({ level: 2, xp: 375 });
  });

  test("registered players receive no xp for failed 40 lines objective", () => {
    const player: Player = {
      id: "registered-1" as UserId,
      socketId: "socket-1",
      connected: true,
      joinedAt: Date.now(),
      profile: {
        nickname: "Player",
        level: 2,
        xp: 75,
      },
    };
    const room = createFortyLinesRoom(player);
    const service = createProgressionService(room);

    service.onMatchStart(room);
    const progression = service.onMatchEnd({
      room,
      state: initGame(20, 10, 1),
      reason: "game_over",
      completedRounds: 1,
      stockLeft: 0,
    });

    expect(progression).toEqual([]);
    expect(player.profile).toMatchObject({ level: 2, xp: 75 });
  });
});
