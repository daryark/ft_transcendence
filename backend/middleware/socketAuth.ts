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
    const numericUserId = Number(userId);

    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        return null;
    }

    const { prisma } = await import("../prisma/prisma.js");
    const user = await prisma.users.findUnique({
        where: { id: numericUserId },
        select: {
            username: true,
            level: true,
            xp: true,
        },
    });

    if (!user) return null;

    return {
        nickname: user.username,
        level: user.level ?? 1,
        xp: user.xp ?? 0,
    };
}

export function socketAuth(playerService: PlayerService) {
    return async (socket: Socket, next: (err?: Error) => void) => {
        try {
            const identity = resolveIdentity(socket.handshake.auth);
            const registeredProfile = identity.type === "registered"
                ? await getRegisteredSocketProfile(identity.id)
                : null;

            if (identity.type === "registered" && !registeredProfile) {
                throw new Error("User no longer exists");
            }

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
                    playerService.addProfile(identity.id, registeredProfile!);
                } else {
                    playerService.addProfile(identity.id, {
                        nickname: getHandshakeUsername(socket) ?? `Guest${identity.id.slice(0, 5)}`,
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
