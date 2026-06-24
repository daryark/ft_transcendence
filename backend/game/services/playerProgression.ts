type ProgressMode = "quickPlay" | "fortyLines" | "blitz" | "customGame";

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

function getCustomXp(input: AwardProgressionInput) {
    const survivedSeconds = Math.max(0, (input.elapsedMs ?? 0) / 1000);
    const winnerXp = Math.min(500, 220 + survivedSeconds * 2.4);

    return Math.round(input.result === "win" ? winnerXp : Math.max(0, winnerXp - 100));
}

export function calculateXpDelta(input: AwardProgressionInput) {
    if (input.mode === "fortyLines") return getFortyLinesXp(input);
    if (input.mode === "blitz") return getBlitzXp(input);
    if (input.mode === "quickPlay") return getQuickplayXp(input);
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

export async function awardPlayerProgression(input: AwardProgressionInput) {
    if (!isPositiveUserId(input.userId)) return null;

    const prisma = await getPrisma();
    const user = await (prisma.users as any).findUnique({
        where: { id: input.userId },
        select: {
            level: true,
            xp: true,
        },
    });
    if (!user) return null;

    const xpDelta = calculateXpDelta(input);
    const levelResult = applyXpToLevel(user.level ?? 1, user.xp ?? 0, xpDelta);

    const updated = await (prisma.users as any).update({
        where: { id: input.userId },
        data: {
            level: levelResult.level,
            xp: levelResult.xp,
            next_level_xp: levelResult.nextLevelXp,
        },
        select: {
            level: true,
            xp: true,
            next_level_xp: true,
        },
    });

    return {
        xpDelta,
        level: updated.level ?? levelResult.level,
        xp: updated.xp ?? levelResult.xp,
        nextLevelXp: updated.next_level_xp ?? levelResult.nextLevelXp,
    };
}
