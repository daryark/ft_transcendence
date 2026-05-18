import type { Socket } from "socket.io";
import PlayerService from "../game/services/playerService";
import { resolveIdentity } from "../auth/identity";

export function socketAuth(playerService: PlayerService) {
    return (socket: Socket, next: (err?: Error) => void) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error("Missing token"));
            }

            const identity = resolveIdentity(token);

            playerService.getOrCreate(
                identity.id,
                socket.id
            );
            socket.data.identity = identity;
            socket.data.joinedAt = Date.now();

            next();
        } catch (error) {
            next(error as Error);
        }
    };
}