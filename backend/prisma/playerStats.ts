import type { Prisma } from "@prisma/client";
import { awardAchievements, type AchievementGameStats } from "./achievements";
import { prisma } from "./prisma";

type PersistMode = "quickPlay" | "fortyLines" | "blitz" | "tetraLeague" | "customGame";

type PersistGameResultInput = {
	userId: number;
	mode: PersistMode;
	score: number;
	achievementScore?: number;
	metricValue?: number | null;
	rankLabel?: string | null;
	result: "win" | "lose" | "draw";
	elapsedMs?: number;
	lines?: number;
	piecesPlaced?: number;
	hardDrops?: number;
	holds?: number;
	maxCombo?: number;
	maxLinesCleared?: number;
	clearedTwoAtOnce?: boolean;
	clearedThreeAtOnce?: boolean;
	tetrises?: number;
	clearedAfterHalfHeight?: boolean;
	roundsPlayed?: number;
	opponentElo?: number;
	stats?: AchievementGameStats;
	progression?: {
		level: number;
		xp: number;
		won: boolean;
	};
};

function isPositiveUserId(userId: number) {
	return Number.isInteger(userId) && userId > 0;
}

function getAchievementStats(
	input: PersistGameResultInput,
): AchievementGameStats & { score: number; multiplayer: boolean } {
	return {
		lines: input.stats?.lines ?? input.lines ?? 0,
		piecesPlaced: input.stats?.piecesPlaced ?? input.piecesPlaced ?? 0,
		hardDrops: input.stats?.hardDrops ?? input.hardDrops ?? 0,
		holds: input.stats?.holds ?? input.holds ?? 0,
		maxCombo: input.stats?.maxCombo ?? input.maxCombo ?? 0,
		maxLinesCleared: input.stats?.maxLinesCleared ?? input.maxLinesCleared ?? 0,
		clearedTwoAtOnce: input.stats?.clearedTwoAtOnce ?? input.clearedTwoAtOnce ?? false,
		clearedThreeAtOnce: input.stats?.clearedThreeAtOnce ?? input.clearedThreeAtOnce ?? false,
		tetrises: input.stats?.tetrises ?? input.tetrises ?? 0,
		durationMs: input.stats?.durationMs ?? input.elapsedMs ?? 0,
		clearedAfterHalfHeight:
			input.stats?.clearedAfterHalfHeight ?? input.clearedAfterHalfHeight ?? false,
		score: input.achievementScore ?? input.score,
		multiplayer: ["quickPlay", "tetraLeague", "customGame"].includes(input.mode),
	};
}

export async function persistGameResult(input: PersistGameResultInput) {
	if (!isPositiveUserId(input.userId)) return [];

	const stats = getAchievementStats(input);
	const achievements = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

		await (tx.match_players as any).create({
			data: {
				match_id: match.id,
				user_id: input.userId,
				score: Math.max(0, Math.floor(input.score)),
				metric_value:
					typeof input.metricValue === "number" && Number.isFinite(input.metricValue)
						? input.metricValue
						: null,
				rank_label:
					typeof input.rankLabel === "string" && input.rankLabel.trim().length > 0
						? input.rankLabel.trim().slice(0, 16)
						: null,
				result: input.result,
				lines: Math.max(0, Math.floor(stats.lines)),
				pieces_placed: Math.max(0, Math.floor(stats.piecesPlaced)),
				hard_drops: Math.max(0, Math.floor(stats.hardDrops)),
				holds: Math.max(0, Math.floor(stats.holds)),
				max_combo: Math.max(0, Math.floor(stats.maxCombo)),
				max_lines_cleared: Math.max(0, Math.floor(stats.maxLinesCleared)),
				cleared_two_at_once: stats.clearedTwoAtOnce,
				cleared_three_at_once: stats.clearedThreeAtOnce,
				tetrises: Math.max(0, Math.floor(stats.tetrises)),
				duration_ms: Math.max(0, Math.floor(stats.durationMs)),
				cleared_after_half_height: stats.clearedAfterHalfHeight,
			},
		});

		return awardAchievements(tx, input.userId, stats);
	});

	if (!input.progression) {
		try {
			const { awardPlayerProgression } = await import("../game/services/playerProgression.js");
			await awardPlayerProgression({
				userId: input.userId,
				mode: input.mode,
				result: input.result,
				score: input.score,
				metricValue: input.metricValue,
				elapsedMs: input.elapsedMs,
				lines: input.lines,
				piecesPlaced: input.piecesPlaced,
				roundsPlayed: input.roundsPlayed,
				opponentElo: input.opponentElo,
			});
		} catch (error) {
			console.error("Failed to award player progression", error);
		}
	}

	return achievements;
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
