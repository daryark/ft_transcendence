import { Socket } from "socket.io";
import RoomService from "../game/services/roomService";
import { SocketData } from ".";


//!what else need to be cleaned up on disconnect?
//!clean player from room, delete room if empty, remove player from playerService, etc.?

export default function disconnectHandlers(
    socket: Socket,
    { roomService }: { roomService: RoomService;}) {
    socket.on("disconnect", () => {
        const { roomId, identity } = socket.data as SocketData;

        if (roomId) {
            roomService.removePlayer(roomId, identity.id);

            console.log(`Disconnected: ${identity.id} from room ${roomId}`);
        }
    });
}