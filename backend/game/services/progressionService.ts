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

function getRegisteredUserId(playerId: string, identityType?: string) {
    if (identityType && identityType !== "registered") return null;

    const userId = Number(playerId);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function isRegisteredProgressionPlayer(player: Room["players"] extends Map<string, infer P> ? P : never) {
    return Boolean(player.profile) && player.identityType !== "anonymous";
}

function getSoloPersistMode(room: Room) {
    if (room.gameConfig.mode !== "solo") return null;
    if (room.gameConfig.preset === "40Lines") return "fortyLines";
    if (room.gameConfig.preset === "blitz") return "blitz";
    return null;
}

function getPersistedScore(room: Room, state: GameState | null) {
    if (!state) return 0;
    if (room.gameConfig.mode === "solo" && room.gameConfig.preset === "40Lines") {
        return state.update?.elapsedMs ?? Math.max(0, Date.now() - state.startedAt);
    }

    return state.score;
}

function persistRegisteredResult(input: MatchEndProgressionInput) {
    const mode =
        getSoloPersistMode(input.room) ??
        (input.room.gameConfig.mode === "league" ? "tetraLeague" : null);

    if (!mode) return;

    const result = input.reason === "objective_complete" ? "win" : "lose";
    const score = getPersistedScore(input.room, input.state);

    for (const player of input.room.players.values()) {
        const userId = getRegisteredUserId(player.id, player.identityType);
        if (!userId) continue;

        void import("../../prisma/playerStats.js")
            .then(({ persistGameResult }) =>
                persistGameResult({
                    userId,
                    mode,
                    score,
                    result,
                }),
            )
            .catch((error) => {
                console.error("Failed to persist game result", error);
            });
    }
}

export default function createProgressionService(room: Room) {
    let startProfiles = new Map<string, boolean>();

    function onMatchStart(currentRoom: Room) {
        startProfiles = new Map(
            Array.from(currentRoom.players.values()).map((player) => [player.id, Boolean(player.profile)])
        );
    }

    function onMatchEnd(input: MatchEndProgressionInput): PlayerProgressionSnapshot[] {
        const outcome: "win" | "defeat" = input.reason === "objective_complete" ? "win" : "defeat";
        persistRegisteredResult(input);

        return Array.from(input.room.players.values())
            .filter(isRegisteredProgressionPlayer)
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
