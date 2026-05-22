import type { Socket } from "socket.io";
import PlayerService from "../game/services/playerService";
import { resolveIdentity } from "../auth/identity";

export function socketAuth(playerService: PlayerService) {
    return (socket: Socket, next: (err?: Error) => void) => {
        try {
            const identity = resolveIdentity(socket.handshake.auth);
            let player = playerService.get(identity.id);

            if (!player) {
                player = playerService.create({
                    socketId: socket.id,
                    id: identity.id,
                    joinedAt: Date.now(),
                    connected: true
                });

                if (identity.type === "registered") {
                    // TODO: Load profile from DB-backed user service when game sockets depend on it.
                    playerService.addProfile(identity.id, {
                        nickname: `User${identity.id.slice(0, 5)}`,
                        level: 1,
                        xp: 0
                    });
                }
            } else {
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
