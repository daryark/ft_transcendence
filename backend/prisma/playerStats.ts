import { prisma } from "./prisma";

type PersistGameResultInput = {
	userId: number;
	mode: "fortyLines" | "blitz" | "tetraLeague";
	score: number;
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

	await prisma.match_players.create({
		data: {
			match_id: match.id,
			user_id: input.userId,
			score: Math.max(0, Math.floor(input.score)),
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
