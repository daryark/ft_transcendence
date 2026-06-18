export const LEAGUE_RANKS = [
    "X",
    "U",
    "SS",
    "S+",
    "S",
    "S-",
    "A+",
    "A",
    "A-",
    "B+",
    "B",
    "B-",
    "C+",
    "C",
    "C-",
    "D+",
    "D",
] as const;

type ProgressMode = "quickPlay" | "fortyLines" | "blitz" | "tetraLeague" | "customGame";

type AwardProgressionInput = {
    userId: number;
    mode: ProgressMode;
    result: "win" | "lose" | "draw";
    score?: number;
    elapsedMs?: number;
    lines?: number;
    piecesPlaced?: number;
    metricValue?: number | null;
    roundsPlayed?: number;
    opponentElo?: number;
};

function isPositiveUserId(userId: number) {
    return Number.isInteger(userId) && userId > 0;
}

async function getPrisma() {
    const { prisma } = await import("../../prisma/prisma.js");
    return prisma;
}

export function getLevelCapacity(level: number) {
    const safeLevel = Math.max(1, Math.floor(level));
    return Math.round(900 + safeLevel * 12 + Math.sqrt(safeLevel) * 135);
}

function getFortyLinesXp(input: AwardProgressionInput) {
    return input.result === "win" ? 300 : 0;
}

function getBlitzXp(input: AwardProgressionInput) {
    return input.result === "win" ? 300 : 0;
}

function getQuickplayXp(input: AwardProgressionInput) {
    const meters = Math.max(0, input.metricValue ?? 0);
    const floorMultiplier = 1 + Math.floor(meters / 100) * 0.12;

    return Math.round(180 + meters * 2.5 * floorMultiplier);
}

function getLeagueXp(input: AwardProgressionInput) {
    const rounds = Math.max(1, input.roundsPlayed ?? 1);
    const resultBonus = input.result === "win" ? 650 : 250;

    return Math.round(2100 + rounds * 180 + resultBonus);
}

function getCustomXp(input: AwardProgressionInput) {
    const survivedSeconds = Math.max(0, (input.elapsedMs ?? 0) / 1000);
    const winnerXp = Math.min(500, 220 + survivedSeconds * 2.4);

    return Math.round(input.result === "win" ? winnerXp : Math.max(0, winnerXp - 100));
}

export function calculateXpDelta(input: AwardProgressionInput) {
    if (input.mode === "fortyLines") return getFortyLinesXp(input);
    if (input.mode === "blitz") return getBlitzXp(input);
    if (input.mode === "quickPlay") return getQuickplayXp(input);
    if (input.mode === "tetraLeague") return getLeagueXp(input);
    if (input.mode === "customGame") return getCustomXp(input);

    return input.result === "win" ? 300 : 150;
}

export function applyXpToLevel(level: number, xp: number, xpDelta: number) {
    let nextLevel = Math.max(1, Math.floor(level || 1));
    let nextXp = Math.max(0, Math.floor(xp || 0)) + Math.max(0, Math.floor(xpDelta));
    let capacity = getLevelCapacity(nextLevel);

    while (nextXp >= capacity) {
        nextXp -= capacity;
        nextLevel += 1;
        capacity = getLevelCapacity(nextLevel);
    }

    return {
        level: nextLevel,
        xp: nextXp,
        nextLevelXp: capacity,
    };
}

export function calculateEloDelta(playerElo: number, opponentElo: number, result: "win" | "lose" | "draw") {
    const expected = 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
    const actual = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
    const kFactor = playerElo < 1200 ? 40 : playerElo < 1800 ? 32 : 24;

    return Math.round(kFactor * (actual - expected));
}

export async function recalculateLeagueRanks() {
    const prisma = await getPrisma();
    const users = await (prisma.users as any).findMany({
        select: {
            id: true,
            league_elo: true,
        },
        orderBy: [
            { league_elo: "desc" },
            { id: "asc" },
        ],
    });

    if (users.length === 0) return;

    const bucketSize = 100 / LEAGUE_RANKS.length;

    await prisma.$transaction(
        users.map((user: { id: number; league_elo: number | null }, index: number) => {
            const percentile = (index / users.length) * 100;
            const rankIndex = Math.min(
                LEAGUE_RANKS.length - 1,
                Math.floor(percentile / bucketSize),
            );

            return (prisma.users as any).update({
                where: { id: user.id },
                data: { league_rank: LEAGUE_RANKS[rankIndex] },
            });
        }),
    );
}

export async function awardPlayerProgression(input: AwardProgressionInput) {
    if (!isPositiveUserId(input.userId)) return null;

    const prisma = await getPrisma();
    const user = await (prisma.users as any).findUnique({
        where: { id: input.userId },
        select: {
            level: true,
            xp: true,
            league_elo: true,
        },
    });
    if (!user) return null;

    const xpDelta = calculateXpDelta(input);
    const levelResult = applyXpToLevel(user.level ?? 1, user.xp ?? 0, xpDelta);
    const currentElo = user.league_elo ?? 1000;
    const eloDelta =
        input.mode === "tetraLeague"
            ? calculateEloDelta(currentElo, input.opponentElo ?? 1000, input.result)
            : 0;

    const updated = await (prisma.users as any).update({
        where: { id: input.userId },
        data: {
            level: levelResult.level,
            xp: levelResult.xp,
            next_level_xp: levelResult.nextLevelXp,
            ...(input.mode === "tetraLeague"
                ? { league_elo: Math.max(100, currentElo + eloDelta) }
                : {}),
        },
        select: {
            level: true,
            xp: true,
            next_level_xp: true,
            league_elo: true,
            league_rank: true,
        },
    });

    if (input.mode === "tetraLeague") {
        await recalculateLeagueRanks();
    }

    return {
        xpDelta,
        eloDelta,
        level: updated.level ?? levelResult.level,
        xp: updated.xp ?? levelResult.xp,
        nextLevelXp: updated.next_level_xp ?? levelResult.nextLevelXp,
        leagueElo: updated.league_elo ?? currentElo + eloDelta,
        leagueRank: updated.league_rank ?? "D",
    };
}
