import type { Socket } from "socket.io";
import PlayerService from "../game/services/playerService";
import { resolveIdentity } from "../auth/identity";

function getHandshakeUsername(socket: Socket) {
    const username = socket.handshake.auth?.username;

    return typeof username === "string" && username.trim().length > 0
        ? username.trim().slice(0, 32)
        : null;
}

async function getRegisteredSocketProfile(userId: string) {
    const fallback = {
        nickname: `User${userId.slice(0, 5)}`,
        level: 1,
        xp: 0,
    };
    const numericUserId = Number(userId);

    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        return fallback;
    }

    try {
        const { prisma } = await import("../prisma/prisma.js");
        const user = await prisma.users.findUnique({
            where: { id: numericUserId },
            select: {
                username: true,
                level: true,
                xp: true,
            },
        });

        return {
            nickname: user?.username ?? fallback.nickname,
            level: user?.level ?? fallback.level,
            xp: user?.xp ?? fallback.xp,
        };
    } catch {
        return fallback;
    }
}

export function socketAuth(playerService: PlayerService) {
    return async (socket: Socket, next: (err?: Error) => void) => {
        try {
            const identity = resolveIdentity(socket.handshake.auth);
            let player = playerService.get(identity.id);

            if (!player) {
                player = playerService.create({
                    socketId: socket.id,
                    id: identity.id,
                    identityType: identity.type,
                    joinedAt: Date.now(),
                    connected: true
                });

                if (identity.type === "registered") {
                    playerService.addProfile(
                        identity.id,
                        await getRegisteredSocketProfile(identity.id),
                    );
                } else {
                    playerService.addProfile(identity.id, {
                        nickname: getHandshakeUsername(socket) ?? `Guest${identity.id.slice(0, 5)}`,
                        level: 1,
                        xp: 0
                    });
                }
            } else {
                if (player.roomId && player.socketId !== socket.id) {
                    socket.data.replacedSocketId = player.socketId;
                }
                playerService.markConnected(identity.id, socket.id);
            }

            socket.data.identity = identity;
            socket.data.joinedAt = player.joinedAt;
            socket.data.roomId = player.roomId;
            socket.data.role = player.role;

            next();
        } catch (error) {
            next(error as Error);
        }
    };
}
