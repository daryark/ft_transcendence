import type Room from "../domain/room";
import type { GameState } from "../domain/engine/state";

export type ProgressionReason = "game_over" | "objective_complete" | "round_timeout";

export interface MatchEndProgressionInput {
    room: Room;
    state: GameState | null;
    reason: ProgressionReason;
    completedRounds: number;
    stockLeft: number;
}

export interface PlayerProgressionSnapshot {
    playerId: string;
    hasProfile: boolean;
    score: number;
    lines: number;
    round: number;
    outcome: "win" | "defeat";
    xpDelta: number;
    rankXpDelta: number;
    level: number;
    xp: number;
}

const XP_PER_LEVEL = 100;

export default function createProgressionService(room: Room) {
    let startProfiles = new Map<string, boolean>();

    function onMatchStart(currentRoom: Room) {
        startProfiles = new Map(
            Array.from(currentRoom.players.values()).map((player) => [player.id, Boolean(player.profile)])
        );
    }

    function onMatchEnd(input: MatchEndProgressionInput): PlayerProgressionSnapshot[] {
        const outcome: "win" | "defeat" = input.reason === "objective_complete" ? "win" : "defeat";

        return Array.from(input.room.players.values())
            .filter((player) => Boolean(player.profile))
            .map((player) => {
                const profile = player.profile!;
                const xpDelta = outcome === "win" ? 100 : 25;
                const totalXp = profile.xp + xpDelta;
                const levelsGained = Math.floor(totalXp / XP_PER_LEVEL);

                profile.level += levelsGained;
                profile.xp = totalXp % XP_PER_LEVEL;

                return {
                    playerId: player.id,
                    hasProfile: startProfiles.get(player.id) ?? true,
                    score: input.state?.score ?? 0,
                    lines: input.state?.lines ?? 0,
                    round: input.state?.round ?? 1,
                    outcome,
                    xpDelta,
                    rankXpDelta: outcome === "win" ? 10 : -5,
                    level: profile.level,
                    xp: profile.xp,
                };
            });
    }

    return {
        onMatchStart,
        onMatchEnd,
    };
}
