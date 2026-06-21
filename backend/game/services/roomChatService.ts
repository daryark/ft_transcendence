import type Room from "../domain/room";
import type RoomService from "./roomService";

const MAX_ROOM_MESSAGES = 100;
const roomMessages = new Map<string, RoomChatMessage[]>();

export type RoomChatMessage = {
  id?: string;
  sender: string;
  message: string;
  system?: boolean;
  actor?: string;
  variant?: string;
  floor?: number;
  floorName?: string;
  meters?: number;
  isPersonalBest?: boolean;
};

export function getRoomMessages(room: Room | null | undefined) {
  if (!room) return [];

  if (!roomMessages.has(room.id)) {
    roomMessages.set(room.id, []);
  }

  return roomMessages.get(room.id) ?? [];
}

export function appendRoomChatMessage(
  room: Room | null | undefined,
  message: Omit<RoomChatMessage, "id">,
) {
  if (!room) return message;

  const messages = getRoomMessages(room);
  const storedMessage = {
    id: `${Date.now()}-${messages.length}`,
    ...message,
  };

  messages.push(storedMessage);
  if (messages.length > MAX_ROOM_MESSAGES) {
    messages.splice(0, messages.length - MAX_ROOM_MESSAGES);
  }

  return storedMessage;
}

export function emitRoomSystemMessage(
  roomService: RoomService,
  room: Room,
  message: string,
  actor?: string,
) {
  const payload = appendRoomChatMessage(room, {
    sender: "SYS",
    system: true,
    actor: actor ? String(actor).toUpperCase() : undefined,
    message,
  });

  roomService.broadcast(room.id, "chat:message" as never, payload);
}

export function clearRoomMessages(roomId: string) {
  roomMessages.delete(roomId);
}
