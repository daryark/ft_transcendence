import type { Server } from "socket.io";

let socketServer: Server | null = null;

export function setSocketServer(io: Server) {
  socketServer = io;
}

export function userSocketRoom(userId: number | string) {
  return `user:${userId}`;
}

export function emitSocialUpdate(
  userIds: Array<number | string>,
  payload: Record<string, unknown>,
) {
  if (!socketServer) return;

  for (const userId of new Set(userIds.map(String))) {
    socketServer.to(userSocketRoom(userId)).emit("social:update", payload);
  }
}

export function emitAchievementUnlocked(
  userId: number | string,
  achievements: Array<{
    id: number;
    code: string;
    name: string;
    description: string;
    rarity: string;
  }>,
) {
  if (!socketServer || achievements.length === 0) return;

  for (const achievement of achievements) {
    socketServer
      .to(userSocketRoom(userId))
      .emit("achievement:unlocked", achievement);
  }
}
