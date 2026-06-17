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

function getRegisteredUserId(player: Player | undefined) {
    if (!player || player.identityType === "anonymous") return null;

    const userId = Number(player.id);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function getPersistMode(room: NonNullable<ReturnType<RoomService["getRoom"]>>) {
    if (room.gameConfig.mode === "quickplay") return "quickPlay";
    if (room.gameConfig.mode === "league") return "tetraLeague";
    return null;
}

function getQuickplayMeters(room: NonNullable<ReturnType<RoomService["getRoom"]>>) {
    if (room.gameConfig.mode !== "quickplay" || !room.state) return null;

    return Number((room.state.lines + room.state.piecesPlaced / 100).toFixed(2));
}

async function persistMultiplayerExitResult(
    room: NonNullable<ReturnType<RoomService["getRoom"]>>,
    winner: Player | undefined,
    loser: Player | undefined,
) {
    const mode = getPersistMode(room);
    if (!mode) return;

    const metricValue = getQuickplayMeters(room);
    const score = room.state?.score ?? 0;
    const rows = [
        { player: winner, result: "win" as const },
        { player: loser, result: "lose" as const },
    ];

    for (const row of rows) {
        const userId = getRegisteredUserId(row.player);
        if (!userId) continue;

        try {
            const { persistGameResult } = await import("../../prisma/playerStats.js");
            await persistGameResult({
                userId,
                mode,
                score,
                metricValue,
                elapsedMs: room.state?.update?.elapsedMs,
                lines: room.state?.lines ?? 0,
                piecesPlaced: room.state?.piecesPlaced ?? 0,
                roundsPlayed: room.state?.round ?? 1,
                rankLabel:
                    room.gameConfig.mode === "league"
                        ? row.player?.profile?.rank ?? "D"
                        : null,
                result: row.result,
            });
        } catch (error) {
            console.error("Failed to persist multiplayer exit result", error);
        }
    }
}

function endMultiplayerRoomAfterPlayerExit(
    roomService: RoomService,
    roomId: RoomId,
    loser: Player | undefined,
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

    void persistMultiplayerExitResult(room, winner, loser)
        .finally(() => {
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
    const leavingPlayer = room.players?.get?.(playerId);
    roomService.removePlayer(roomId, playerId);

    if (roomService.isEmpty(roomId)) {
        roomService.deleteRoom(roomId);
        return true;
    }

    if (room.gameConfig.mode !== "solo" && wasPlaying) {
        endMultiplayerRoomAfterPlayerExit(roomService, roomId, leavingPlayer);
    }

    return true;
}
