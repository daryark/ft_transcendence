import { prisma } from "./prisma";

type PersistGameResultInput = {
	userId: number;
	mode: "quickPlay" | "fortyLines" | "blitz" | "tetraLeague" | "customGame";
	score: number;
	metricValue?: number | null;
	rankLabel?: string | null;
	result: "win" | "lose" | "draw";
	elapsedMs?: number;
	lines?: number;
	piecesPlaced?: number;
	roundsPlayed?: number;
	opponentElo?: number;
};

function isPositiveUserId(userId: number) {
	return Number.isInteger(userId) && userId > 0;
}

export async function persistGameResult(input: PersistGameResultInput) {
	if (!isPositiveUserId(input.userId)) return;

	const match = await prisma.matches.create({
		data: {
			status: "finished",
			gamemode: input.mode,
		},
		select: { id: true },
	});

	await (prisma.match_players as any).create({
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
		},
	});

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
