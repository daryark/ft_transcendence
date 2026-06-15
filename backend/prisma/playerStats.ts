import { prisma } from "./prisma";

type PersistGameResultInput = {
	userId: number;
	mode: "quickPlay" | "fortyLines" | "blitz" | "tetraLeague";
	score: number;
	metricValue?: number | null;
	rankLabel?: string | null;
	result: "win" | "lose" | "draw";
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
