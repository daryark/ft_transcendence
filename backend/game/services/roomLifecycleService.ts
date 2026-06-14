import type { RoomId } from "../domain/room";
import type Player from "../domain/player";
import { removeCustomRoomParticipant } from "../domain/mode/custom/index.js";
import type RoomService from "./roomService";

type ParticipantRole = "player" | "spectator";

function getPlayerResult(player: Player | undefined) {
    return player
        ? {
            id: player.id,
            nickname: player.profile?.nickname,
            place: 1,
        }
        : undefined;
}

function endMultiplayerRoomAfterPlayerExit(
    roomService: RoomService,
    roomId: RoomId,
    reason = "player_left",
) {
    const room = roomService.getRoom(roomId);
    if (!room || room.gameConfig.mode === "solo" || room.status !== "playing") {
        return;
    }

    const winner = Array.from(room.players.values())[0];

    room.match?.stop();
    room.engine?.stop();
    room.match = null;
    room.engine = null;
    room.status = "ended";

    roomService.broadcast(roomId, "game:end", {
        roomId,
        reason,
        state: room.state,
        winnerId: winner ? String(winner.id) : null,
        result: {
            outcome: winner ? "win" : "defeat",
            stats: null,
            player: getPlayerResult(winner),
        },
    });
}

export function leaveRoomParticipant(
    roomService: RoomService,
    roomId: RoomId,
    playerId: Player["id"],
    role: ParticipantRole,
) {
    const room = roomService.getRoom(roomId);
    if (!room) return false;

    if (room.gameConfig.mode === "custom") {
        return removeCustomRoomParticipant(roomService, roomId, playerId, role);
    }

    if (role === "spectator") {
        roomService.removeSpectator(roomId, playerId);
        if (roomService.isEmpty(roomId)) {
            roomService.deleteRoom(roomId);
        }
        return true;
    }

    const wasPlaying = room.status === "playing";
    roomService.removePlayer(roomId, playerId);

    if (roomService.isEmpty(roomId)) {
        roomService.deleteRoom(roomId);
        return true;
    }

    if (room.gameConfig.mode !== "solo" && wasPlaying) {
        endMultiplayerRoomAfterPlayerExit(roomService, roomId);
    }

    return true;
}
