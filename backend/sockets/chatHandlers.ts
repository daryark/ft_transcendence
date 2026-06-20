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
        const quickplayResult =
            data &&
            typeof data === "object" &&
            "quickplayResult" in data &&
            data.quickplayResult &&
            typeof data.quickplayResult === "object"
                ? data.quickplayResult as {
                    floor?: unknown;
                    floorName?: unknown;
                    isPersonalBest?: unknown;
                    meters?: unknown;
                }
                : null;

        if (!roomId || !identity || !message || message.length > 500) {
            socket.emit("server:error", { reason: "INVALID_CHAT_MESSAGE" });
            return;
        }

        const room = roomService.getRoom(roomId as never);
        const payload = appendRoomChatMessage(room, {
            sender: getPlayerName(roomService, roomId, String(identity.id)),
            message,
            ...(quickplayResult && room?.gameConfig.mode === "quickplay"
                ? {
                    variant: "quickplay-result",
                    floor: typeof quickplayResult.floor === "number" ? quickplayResult.floor : undefined,
                    floorName: typeof quickplayResult.floorName === "string" ? quickplayResult.floorName : undefined,
                    meters: typeof quickplayResult.meters === "number" ? quickplayResult.meters : undefined,
                    isPersonalBest: Boolean(quickplayResult.isPersonalBest),
                }
                : {}),
        });

        io.to(roomId).emit("chat:message", payload);
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
