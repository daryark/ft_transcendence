import type { Socket } from "socket.io";
import type { SocketData } from "../../sockets";
import type RoomService from "./roomService";
import { clearSocketRoom, leaveSocketRoomNow } from "../../sockets/roomSocketExit";

export function interruptGameSession(socket: Socket, roomService: RoomService) {
    const { roomId } = socket.data as SocketData;
    if (!roomId) return false;

    const room = roomService.getRoom(roomId);
    if (!room) {
        clearSocketRoom(socket, roomId);
        return false;
    }

    if (room.gameConfig.mode === "solo") {
        room.match?.stop();
        room.engine?.stop();

        if (room.gameConfig.objective.winCondition === "none") {
            roomService.broadcast(roomId, "game:end", {
                roomId,
                reason: "manual_exit",
                state: room.state,
                result: {
                    outcome: "defeat",
                    stats: null,
                },
            });
        }

        roomService.deleteRoom(roomId);
        clearSocketRoom(socket, roomId);
        return true;
    }

    return leaveSocketRoomNow(socket, roomService);
}
