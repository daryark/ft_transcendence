import { prisma } from "./prisma";

export type MatchStatus = "active" | "finished";
export type GameMode = "classic" | "blitz" | "rush";
export type PlayerResult = "win" | "lose" | "draw";

export type MatchRecord = {
	id: number;
	status: MatchStatus | null;
	gamemode: GameMode | null;
	created_at: Date | null;
};

export type MatchPlayerRecord = {
	id: number;
	match_id: number;
	user_id: number;
	score: number | null;
	result: PlayerResult | null;
};

export interface CreateMatchInput {
	status?: MatchStatus;
	gamemode?: GameMode;
}

export interface UpdateMatchInput {
	status?: MatchStatus;
	gamemode?: GameMode;
}

export interface AddMatchPlayerInput {
	matchId: number;
	userId: number;
	score?: number;
	result?: PlayerResult;
}

export interface ListMatchesOptions {
	status?: MatchStatus;
	gamemode?: GameMode;
	limit?: number;
}

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

export async function createMatch(rawInput: CreateMatchInput = {}): Promise<MatchRecord> {
	return prisma.matches.create({
		data: {
			...(rawInput.status ? { status: rawInput.status } : {}),
			...(rawInput.gamemode ? { gamemode: rawInput.gamemode } : {}),
		},
		select: {
			id: true,
			status: true,
			gamemode: true,
			created_at: true,
		},
	});
}

export async function getMatchById(matchId: number) {
	assertPositiveInteger(matchId, "matchId");

	return prisma.matches.findUnique({
		where: { id: matchId },
		include: {
			match_players: {
				include: {
					users: {
						select: {
							id: true,
							username: true,
						},
					},
				},
				orderBy: {
					id: "asc",
				},
			},
		},
	});
}

export async function listMatches(options: ListMatchesOptions = {}) {
	const limit = options.limit ?? 100;
	assertPositiveInteger(limit, "limit");

	return prisma.matches.findMany({
		where: {
			...(options.status ? { status: options.status } : {}),
			...(options.gamemode ? { gamemode: options.gamemode } : {}),
		},
		orderBy: {
			created_at: "desc",
		},
		take: limit,
		include: {
			match_players: {
				select: {
					id: true,
					user_id: true,
					score: true,
					result: true,
				},
			},
		},
	});
}

export async function updateMatch(matchId: number, rawInput: UpdateMatchInput) {
	assertPositiveInteger(matchId, "matchId");

	return prisma.matches.update({
		where: { id: matchId },
		data: {
			...(rawInput.status ? { status: rawInput.status } : {}),
			...(rawInput.gamemode ? { gamemode: rawInput.gamemode } : {}),
		},
		select: {
			id: true,
			status: true,
			gamemode: true,
			created_at: true,
		},
	});
}

export async function deleteMatch(matchId: number) {
	assertPositiveInteger(matchId, "matchId");

	return prisma.matches.delete({
		where: { id: matchId },
	});
}

export async function addMatchPlayer(rawInput: AddMatchPlayerInput): Promise<MatchPlayerRecord> {
	assertPositiveInteger(rawInput.matchId, "matchId");
	assertPositiveInteger(rawInput.userId, "userId");

	const match = await prisma.matches.findUnique({
		where: { id: rawInput.matchId },
		select: { id: true },
	});
	if (!match) {
		throw new Error("Match not found");
	}

	const user = await prisma.users.findUnique({
		where: { id: rawInput.userId },
		select: { id: true },
	});
	if (!user) {
		throw new Error("User not found");
	}

	const existing = await prisma.match_players.findFirst({
		where: {
			match_id: rawInput.matchId,
			user_id: rawInput.userId,
		},
		select: { id: true },
	});
	if (existing) {
		throw new Error("Player already exists in this match");
	}

	return prisma.match_players.create({
		data: {
			match_id: rawInput.matchId,
			user_id: rawInput.userId,
			...(typeof rawInput.score === "number" ? { score: rawInput.score } : {}),
			...(rawInput.result ? { result: rawInput.result } : {}),
		},
		select: {
			id: true,
			match_id: true,
			user_id: true,
			score: true,
			result: true,
		},
	});
}

export async function listMatchPlayers(matchId: number) {
	assertPositiveInteger(matchId, "matchId");

	return prisma.match_players.findMany({
		where: { match_id: matchId },
		orderBy: { id: "asc" },
		include: {
			users: {
				select: {
					id: true,
					username: true,
				},
			},
		},
	});
}

export async function finishMatch(matchId: number) {
	return updateMatch(matchId, { status: "finished" });
}
