import { Server, Socket } from "socket.io";

export default function chatHandlers(io: Server, socket: Socket) {
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

        io.to(roomId).emit("chat:message", {
            sender: String(identity.id),
            message,
        });
    });
};


// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
