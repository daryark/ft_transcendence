import { describe, expect, jest, test } from "@jest/globals";
import type Room from "../../game/domain/room";
import type { RoomId } from "../../game/domain/room";
import {
  appendRoomChatMessage,
  clearRoomMessages,
  emitRoomSystemMessage,
  getRoomMessages,
} from "../../game/services/roomChatService";

function createRoom(id = "ROOM-1"): Room {
  return {
    id: id as RoomId,
    status: "lobby",
    players: new Map(),
    state: null,
    engine: null,
    match: null,
    roomConfig: {},
    gameConfig: { mode: "solo" },
  } as Room;
}

describe("room chat service", () => {
  test("returns an empty list for missing rooms without creating storage", () => {
    expect(getRoomMessages(null)).toEqual([]);
    expect(appendRoomChatMessage(undefined, { sender: "P1", message: "hi" })).toEqual({
      sender: "P1",
      message: "hi",
    });
  });

  test("appends generated ids and keeps messages per room", () => {
    jest.spyOn(Date, "now").mockReturnValue(1000);
    const firstRoom = createRoom("ROOM-1");
    const secondRoom = createRoom("ROOM-2");

    const message = appendRoomChatMessage(firstRoom, {
      sender: "P1",
      message: "hello",
    });
    appendRoomChatMessage(secondRoom, { sender: "P2", message: "world" });

    expect(message).toEqual({ id: "1000-0", sender: "P1", message: "hello" });
    expect(getRoomMessages(firstRoom)).toHaveLength(1);
    expect(getRoomMessages(secondRoom)).toHaveLength(1);
  });

  test("keeps only the newest 100 messages per room", () => {
    const room = createRoom();

    for (let index = 0; index < 105; index += 1) {
      appendRoomChatMessage(room, {
        sender: "P1",
        message: `message-${index}`,
      });
    }

    const messages = getRoomMessages(room);
    expect(messages).toHaveLength(100);
    expect(messages[0]?.message).toBe("message-5");
    expect(messages[99]?.message).toBe("message-104");
  });

  test("broadcasts system messages with normalized actor names", () => {
    const room = createRoom();
    const roomService = {
      broadcast: jest.fn(),
    };

    emitRoomSystemMessage(roomService as never, room, "joined", "alice");

    expect(roomService.broadcast).toHaveBeenCalledWith(
      room.id,
      "chat:message",
      expect.objectContaining({
        sender: "SYS",
        system: true,
        actor: "ALICE",
        message: "joined",
      }),
    );
  });

  test("clears stored messages for a room", () => {
    const room = createRoom();
    appendRoomChatMessage(room, { sender: "P1", message: "hello" });

    clearRoomMessages(room.id);

    expect(getRoomMessages(room)).toEqual([]);
  });
});
