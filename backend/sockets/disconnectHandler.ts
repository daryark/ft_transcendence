import { Socket } from "socket.io";
import RoomService from "../game/services/roomService";
import { SocketData } from ".";
import PlayerService from "../game/services/playerService";


//!what else need to be cleaned up on disconnect?
//!clean player from room, delete room if empty, remove player from playerService, etc.?

export default function disconnectHandlers(
    socket: Socket,
    { roomService, playerService }: { roomService: RoomService; playerService: PlayerService;}) {
    socket.on("disconnect", () => {
        const { identity } = socket.data as SocketData;
        if (!identity) return;

        const player = playerService.markDisconnected(identity.id, (expiredPlayer) => {
            if (!expiredPlayer.roomId || !expiredPlayer.role) return;

            if (expiredPlayer.role === "player") {
                roomService.removePlayer(expiredPlayer.roomId, expiredPlayer.id);
            } else {
                roomService.removeSpectator(expiredPlayer.roomId, expiredPlayer.id);
            }
        });
        
        console.log(`Disconnected: ${identity.id}; waiting 30s for reconnect${player?.roomId ? ` in room ${player.roomId}` : ""}`);
    });
}
