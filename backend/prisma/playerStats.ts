import { awardAchievements, type AchievementGameStats } from "./achievements";
import { prisma } from "./prisma";

type PersistGameResultInput = {
	userId: number;
	mode: "fortyLines" | "blitz" | "quickPlay" | "tetraLeague" | "customGame";
	score: number;
	achievementScore?: number;
	result: "win" | "lose" | "draw";
	stats: AchievementGameStats;
	progression?: {
		level: number;
		xp: number;
		won: boolean;
	};
};

function isPositiveUserId(userId: number) {
	return Number.isInteger(userId) && userId > 0;
}

export async function persistGameResult(input: PersistGameResultInput) {
	if (!isPositiveUserId(input.userId)) return;

	return prisma.$transaction(async (tx) => {
		if (input.progression) {
			await tx.users.update({
				where: { id: input.userId },
				data: {
					level: Math.max(1, Math.floor(input.progression.level)),
					xp: Math.max(0, Math.floor(input.progression.xp)),
					...(input.progression.won ? { wins: { increment: 1 } } : {}),
				},
			});
		} else if (input.result === "win") {
			await tx.users.update({
				where: { id: input.userId },
				data: { wins: { increment: 1 } },
			});
		}

		const match = await tx.matches.create({
			data: {
				status: "finished",
				gamemode: input.mode,
			},
			select: { id: true },
		});

		await tx.match_players.create({
			data: {
				match_id: match.id,
				user_id: input.userId,
				score: Math.max(0, Math.floor(input.score)),
				result: input.result,
				lines: Math.max(0, Math.floor(input.stats.lines)),
				pieces_placed: Math.max(0, Math.floor(input.stats.piecesPlaced)),
				hard_drops: Math.max(0, Math.floor(input.stats.hardDrops)),
				holds: Math.max(0, Math.floor(input.stats.holds)),
				max_combo: Math.max(0, Math.floor(input.stats.maxCombo)),
				max_lines_cleared: Math.max(0, Math.floor(input.stats.maxLinesCleared)),
				cleared_two_at_once: input.stats.clearedTwoAtOnce,
				cleared_three_at_once: input.stats.clearedThreeAtOnce,
				tetrises: Math.max(0, Math.floor(input.stats.tetrises)),
				duration_ms: Math.max(0, Math.floor(input.stats.durationMs)),
				cleared_after_half_height: input.stats.clearedAfterHalfHeight,
			},
		});

		return awardAchievements(tx, input.userId, {
			...input.stats,
			score: input.achievementScore ?? input.score,
			multiplayer: ["quickPlay", "tetraLeague", "customGame"].includes(input.mode),
		});
	});
}

export async function incrementPlayTimeSeconds(userId: number, seconds: number) {
	if (!isPositiveUserId(userId) || !Number.isFinite(seconds) || seconds <= 0) {
		return;
	}

	await prisma.users.update({
		where: { id: userId },
		data: {
			play_time_seconds: {
				increment: Math.floor(seconds),
			},
		},
	});
}
