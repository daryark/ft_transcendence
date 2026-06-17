import type { Server } from "socket.io";
import { userSocketRoom } from "../sockets/realtime";

let socketServer: Server | null = null;

export function setNotificationSocketServer(io: Server) {
	socketServer = io;
}

export function emitNotification(userId: number | string, payload: Record<string, unknown>) {
	if (!socketServer) return;
	socketServer.to(userSocketRoom(userId)).emit("notifications", payload);
}