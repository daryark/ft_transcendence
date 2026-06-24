import type { Socket } from "socket.io";
import type { SocketData } from ".";
import type RoomService from "../game/services/roomService";
import { leaveRoomParticipant } from "../game/services/roomLifecycleService";

export function clearSocketRoom(socket: Socket, roomId: string) {
    socket.leave?.(roomId);
    socket.data.roomId = undefined;
    socket.data.role = undefined;
}

export function leaveSocketRoomNow(socket: Socket, roomService: RoomService) {
    const { identity, roomId, role } = socket.data as SocketData;
    if (!identity || !roomId || !role) return false;

    clearSocketRoom(socket, roomId);
    return leaveRoomParticipant(roomService, roomId, identity.id, role);
}
