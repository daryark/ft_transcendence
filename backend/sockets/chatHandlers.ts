import { Server, Socket } from "socket.io";
import RoomService from "../game/services/roomService";
import { appendRoomChatMessage } from "../game/services/roomChatService";

function getPlayerName(roomService: RoomService, roomId: string, playerId: string) {
    const room = roomService.getRoom(roomId as never);
    const player =
        room?.players.get(playerId as never) ??
        room?.spectators?.get(playerId as never);

    return player?.profile?.nickname ?? String(playerId);
}

export default function chatHandlers(
    io: Server,
    socket: Socket,
    { roomService }: { roomService: RoomService },
) {
    socket.on("chat:message", (data: unknown) => {
        const { identity, roomId } = socket.data;
        const message =
            data &&
            typeof data === "object" &&
            "message" in data &&
            typeof data.message === "string"
                ? data.message.trim()
                : "";

        if (!roomId || !identity || !message || message.length > 500) {
            socket.emit("server:error", { reason: "INVALID_CHAT_MESSAGE" });
            return;
        }

        const room = roomService.getRoom(roomId as never);
        const payload = appendRoomChatMessage(room, {
            sender: getPlayerName(roomService, roomId, String(identity.id)),
            message,
        });

        io.to(roomId).emit("chat:message", payload);
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
