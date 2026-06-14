import { Socket } from "socket.io";
import RoomService from "../game/services/roomService";
import { SocketData } from ".";
import PlayerService from "../game/services/playerService";
import { leaveRoomParticipant } from "../game/services/roomLifecycleService";


//!what else need to be cleaned up on disconnect?
//!clean player from room, delete room if empty, remove player from playerService, etc.?

export default function disconnectHandlers(
    socket: Socket,
    { roomService, playerService }: { roomService: RoomService; playerService: PlayerService; }) {
    socket.on("disconnect", () => {
        const { identity } = socket.data as SocketData;
        if (!identity) return;
        const currentPlayer = playerService.get(identity.id);
        const currentRoom = currentPlayer?.roomId
            ? roomService.getRoom(currentPlayer.roomId)
            : undefined;

        const reconnectTimeoutMs =
            currentRoom?.gameConfig.mode === "league" ? undefined : 0;

        if (identity.type === "registered" && currentPlayer) {
            const userId = Number(identity.id);
            const seconds = Math.floor((Date.now() - currentPlayer.joinedAt) / 1000);

            if (Number.isInteger(userId) && userId > 0 && seconds > 0) {
                currentPlayer.joinedAt = Date.now();
                void import("../prisma/playerStats.js")
                    .then(({ incrementPlayTimeSeconds }) =>
                        incrementPlayTimeSeconds(userId, seconds),
                    )
                    .catch((error) => {
                        console.error("Failed to persist play time", error);
                    });
            }
        }

        const player = playerService.markDisconnected(identity.id, (expiredPlayer) => {
            if (!expiredPlayer.roomId || !expiredPlayer.role) return;

            leaveRoomParticipant(
                roomService,
                expiredPlayer.roomId,
                expiredPlayer.id,
                expiredPlayer.role,
            );
        }, reconnectTimeoutMs);

        console.log(
            `Disconnected: ${identity.id}; ${
                reconnectTimeoutMs === 0 ? "removed from room" : "waiting 30s for reconnect"
            }${player?.roomId ? ` in room ${player.roomId}` : ""}`,
        );
    });
}
