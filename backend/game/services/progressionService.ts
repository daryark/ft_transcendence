import type Room from "../domain/room";
import type { GameState } from "../domain/engine/state";
import {
    applyXpToLevel,
    calculateXpDelta,
} from "./playerProgression";

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

function getPersistMode(room: Room) {
    const soloMode = getSoloPersistMode(room);
    if (soloMode) return soloMode;
    if (room.gameConfig.mode === "quickplay") return "quickPlay";
    if (room.gameConfig.mode === "league") return "tetraLeague";
    return null;
}

function getPersistedScore(room: Room, state: GameState | null) {
    if (!state) return 0;
    if (room.gameConfig.mode === "solo" && room.gameConfig.preset === "40Lines") {
        return state.update?.elapsedMs ?? Math.max(0, Date.now() - state.startedAt);
    }

    return state.score;
}

function getQuickplayMeters(room: Room, state: GameState | null) {
    if (room.gameConfig.mode !== "quickplay" || !state) return null;

    return Number((state.lines + state.piecesPlaced / 100).toFixed(2));
}

function getProgressionMode(room: Room) {
    return getPersistMode(room) ?? "customGame";
}

function getProgressionMetric(room: Room, state: GameState | null) {
    if (room.gameConfig.mode === "quickplay") {
        return getQuickplayMeters(room, state);
    }

    return null;
}

async function persistRegisteredResult(input: MatchEndProgressionInput) {
    const mode = getPersistMode(input.room);
    if (!mode) return;

    const result = input.reason === "objective_complete" ? "win" : "lose";
    const score = getPersistedScore(input.room, input.state);
    const metricValue = getQuickplayMeters(input.room, input.state);

    for (const player of input.room.players.values()) {
        const userId = getRegisteredUserId(player.id, player.identityType);
        if (!userId) continue;

        try {
            const { persistGameResult } = await import("../../prisma/playerStats.js");
            await persistGameResult({
                userId,
                mode,
                score,
                metricValue,
                elapsedMs: input.state?.update?.elapsedMs,
                lines: input.state?.lines ?? 0,
                piecesPlaced: input.state?.piecesPlaced ?? 0,
                roundsPlayed: Math.max(1, input.completedRounds),
                rankLabel:
                    input.room.gameConfig.mode === "league"
                        ? player.profile?.rank ?? "D"
                        : null,
                result,
            });
        } catch (error) {
            console.error("Failed to persist game result", error);
        }
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
        const result = outcome === "win" ? "win" : "lose";
        const mode = getProgressionMode(input.room);
        const score = getPersistedScore(input.room, input.state);
        const metricValue = getProgressionMetric(input.room, input.state);
        const elapsedMs =
            input.state?.update?.elapsedMs ??
            (input.state ? Math.max(0, Date.now() - input.state.startedAt) : 0);

        return Array.from(input.room.players.values())
            .filter(isRegisteredProgressionPlayer)
            .map((player) => {
                const profile = player.profile!;
                const xpDelta = calculateXpDelta({
                    userId: Number(player.id),
                    mode,
                    result,
                    score,
                    metricValue,
                    elapsedMs,
                    lines: input.state?.lines ?? 0,
                    piecesPlaced: input.state?.piecesPlaced ?? 0,
                    roundsPlayed: Math.max(1, input.completedRounds),
                });
                const levelResult = applyXpToLevel(profile.level, profile.xp, xpDelta);

                profile.level = levelResult.level;
                profile.xp = levelResult.xp;

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
        persistMatchEnd: persistRegisteredResult,
    };
}
