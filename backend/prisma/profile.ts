import { z } from "zod";
import { prisma } from "./prisma";

const profileUpdateSchema = z
	.object({
		avatarId: z.number().int().min(0).optional(),
		country: z.string().trim().min(1).max(100).optional(),
		level: z.number().int().min(1).optional(),
		xp: z.number().int().min(0).optional(),
		nextLevelXp: z.number().int().min(1).optional(),
		playTimeHours: z.number().int().min(0).optional(),
	})
	.refine((value) => Object.values(value).some((field) => field !== undefined), {
		message: "At least one profile field is required",
	});

export type ProfileModeStats = {
	value: string;
	achievedAgo?: string;
} | null;

export type ProfileResponse = {
	id: number;
	username: string;
	country?: string;
	avatarId: number;
	created_at: Date | null;
	level: number;
	xp: number;
	nextLevelXp: number;
	playTimeHours: number;
	onlineGames: number;
	wins: number;
	modes: {
		quickPlay: ProfileModeStats;
		fortyLines: ProfileModeStats;
		blitz: ProfileModeStats;
		zen: ProfileModeStats;
	};
};

export type UpdateProfileInput = z.infer<typeof profileUpdateSchema>;

type ProfileUserRecord = {
	id: number;
	username: string;
	country?: string | null;
	avatar_id: number | null;
	created_at: Date | null;
	level: number | null;
	xp: number | null;
	next_level_xp: number | null;
	play_time_seconds: number | null;
	wins: number | null;
};

type ProfileModeRow = {
	score: number | null;
	metric_value?: number | null;
	result: string | null;
	matches: {
		gamemode: string | null;
		created_at: Date | null;
	} | null;
};

const modeAliases: Record<string, keyof ProfileResponse["modes"]> = {
	quickPlay: "quickPlay",
	fortyLines: "fortyLines",
	blitz: "blitz",
	zen: "zen",
};

function isMissingCountryFieldError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("Unknown field `country`") || message.includes("Unknown arg `country`");
}

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

function normalizeCountry(country: string | null | undefined): string | undefined {
	if (!country) {
		return undefined;
	}

	const trimmed = country.trim();
	if (trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") {
		return undefined;
	}

	return trimmed.length > 0 ? trimmed : undefined;
}

function formatAchievedAgo(achievedAt: Date | null): string | undefined {
	if (!achievedAt) {
		return undefined;
	}

	const diffMs = Date.now() - achievedAt.getTime();
	const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	return days > 0 ? `${days} days ago` : "recently";
}

function formatDuration(milliseconds: number): string {
	const safeMilliseconds = Math.max(0, Math.round(milliseconds));
	const minutes = Math.floor(safeMilliseconds / 60000);
	const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
	const remainder = safeMilliseconds % 1000;

	return `${minutes}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
}

function toScoreStats(score: number | null, achievedAt: Date | null): ProfileModeStats {
	if (score === null || score === undefined) {
		return null;
	}

	return {
		value: `${score.toLocaleString("en-US")} pts`,
		achievedAgo: formatAchievedAgo(achievedAt),
	};
}

function toQuickPlayStats(metricValue: number | null, achievedAt: Date | null): ProfileModeStats {
	if (metricValue === null || metricValue === undefined) {
		return null;
	}

	return {
		value: `${metricValue.toLocaleString("en-US", {
			maximumFractionDigits: 2,
		})} m`,
		achievedAgo: formatAchievedAgo(achievedAt),
	};
}

function toFortyLinesStats(score: number | null, achievedAt: Date | null): ProfileModeStats {
	if (score === null || score === undefined) {
		return null;
	}

	return {
		value: formatDuration(score),
		achievedAgo: formatAchievedAgo(achievedAt),
	};
}

function isBetterModeScore(
	mode: keyof ProfileResponse["modes"],
	score: number,
	current?: { score: number; achievedAt: Date | null; metricValue?: number | null },
	next?: { metricValue?: number | null },
) {
	if (!current) return true;
	if (mode === "fortyLines") return score < current.score;
	if (mode === "quickPlay") {
		return (next?.metricValue ?? score) > (current.metricValue ?? current.score);
	}
	return score > current.score;
}

function buildProfileResponse(
	user: ProfileUserRecord,
	matchRows: ProfileModeRow[],
): ProfileResponse {
	const bestModeStats: Partial<Record<keyof ProfileResponse["modes"], { score: number; achievedAt: Date | null; metricValue?: number | null }>> = {};
	let onlineGames = 0;
	let onlineWins = 0;

	for (const row of matchRows) {
		const mode = row.matches?.gamemode;
		if (mode === "quickPlay" || mode === "customGame") {
			onlineGames += 1;
			if (row.result === "win") {
				onlineWins += 1;
			}
		}

		if (!mode || !(mode in modeAliases)) {
			continue;
		}

		const key = modeAliases[mode as keyof typeof modeAliases];
		const score = row.score ?? 0;
		const current = bestModeStats[key];
		const next = {
			metricValue: row.metric_value ?? null,
		};

		if (isBetterModeScore(key, score, current, next)) {
			bestModeStats[key] = {
				score,
				...next,
				achievedAt: row.matches?.created_at ?? null,
			};
		}
	}

	return {
		id: user.id,
		username: user.username,
		country: normalizeCountry(user.country),
		avatarId: user.avatar_id ?? 0,
		created_at: user.created_at,
		level: user.level ?? 1,
		xp: user.xp ?? 0,
		nextLevelXp: user.next_level_xp ?? 100,
		playTimeHours: Math.round(((user.play_time_seconds ?? 0) / 3600) * 10) / 10,
		onlineGames,
		wins: onlineWins,
		modes: {
			quickPlay: toQuickPlayStats(bestModeStats.quickPlay?.metricValue ?? null, bestModeStats.quickPlay?.achievedAt ?? null),
			fortyLines: toFortyLinesStats(bestModeStats.fortyLines?.score ?? null, bestModeStats.fortyLines?.achievedAt ?? null),
			blitz: toScoreStats(bestModeStats.blitz?.score ?? null, bestModeStats.blitz?.achievedAt ?? null),
			zen: toScoreStats(bestModeStats.zen?.score ?? null, bestModeStats.zen?.achievedAt ?? null),
		},
	};
}

async function findUserByField(
	field: "id" | "username",
	value: string | number,
): Promise<ProfileUserRecord | null> {
	const where = field === "id" ? { id: value as number } : { username: value as string };
	const select = {
		id: true,
		username: true,
		country: true,
		avatar_id: true,
		created_at: true,
		level: true,
		xp: true,
		next_level_xp: true,
		play_time_seconds: true,
		wins: true,
	} as const;

	try {
		const result = await prisma.users.findUnique({
			where: where as any,
			select: select as any,
		});

		return result as ProfileUserRecord | null;
	} catch (error) {
		if (!isMissingCountryFieldError(error)) {
			throw error;
		}

		const fallbackSelect = {
			id: true,
			username: true,
			avatar_id: true,
			created_at: true,
			level: true,
			xp: true,
			next_level_xp: true,
			play_time_seconds: true,
			wins: true,
		} as const;

		const fallbackResult = await prisma.users.findUnique({
			where: where as any,
			select: fallbackSelect as any,
		});

		return fallbackResult as ProfileUserRecord | null;
	}
}

async function loadUserProfileRows(userId: number): Promise<ProfileModeRow[]> {
	return await prisma.match_players.findMany({
		where: { user_id: userId },
		select: {
			score: true,
			metric_value: true,
			result: true,
			matches: {
				select: {
					gamemode: true,
					created_at: true,
				},
			},
		},
	});
}

export async function getProfileByUsername(username: string): Promise<ProfileResponse> {
	const normalizedUsername = z.string().trim().min(1).max(100).parse(username);
	const user = await findUserByField("username", normalizedUsername);

	if (!user) {
		throw new Error("User not found");
	}

	const matchRows = await loadUserProfileRows(user.id);
	return buildProfileResponse(user, matchRows);
}

export type MiniProfileResponse = {
	miniprofile: {
		id: number;
		username: string;
		avatarId: number;
		level: number;
		modes: {
			quickPlay?: ProfileModeStats;
			fortyLines?: ProfileModeStats;
			blitz?: ProfileModeStats;
			zen?: ProfileModeStats;
		};
	};
};

function buildMiniProfileResponse(user: ProfileUserRecord, matchRows: ProfileModeRow[]): MiniProfileResponse {
	const bestModeStats: Partial<Record<keyof ProfileResponse["modes"], { score: number; achievedAt: Date | null; metricValue?: number | null }>> = {};

	for (const row of matchRows) {
		const mode = row.matches?.gamemode;
		if (!mode || !(mode in modeAliases)) {
			continue;
		}

		const key = modeAliases[mode as keyof typeof modeAliases];
		const score = row.score ?? 0;
		const current = bestModeStats[key];
		const next = {
			metricValue: row.metric_value ?? null,
		};

		if (isBetterModeScore(key, score, current, next)) {
			bestModeStats[key] = {
				score,
				...next,
				achievedAt: row.matches?.created_at ?? null,
			};
		}
	}

	return {
		miniprofile: {
			id: user.id,
			username: user.username,
			avatarId: user.avatar_id ?? 0,
			level: user.level ?? 1,
			modes: {
				quickPlay: toQuickPlayStats(bestModeStats.quickPlay?.metricValue ?? null, bestModeStats.quickPlay?.achievedAt ?? null),
				fortyLines: toFortyLinesStats(bestModeStats.fortyLines?.score ?? null, bestModeStats.fortyLines?.achievedAt ?? null),
				blitz: toScoreStats(bestModeStats.blitz?.score ?? null, bestModeStats.blitz?.achievedAt ?? null),
				zen: toScoreStats(bestModeStats.zen?.score ?? null, bestModeStats.zen?.achievedAt ?? null),
			},
		},
	};
}

export async function getMiniProfileByUsername(username: string): Promise<MiniProfileResponse> {
	const normalizedUsername = z.string().trim().min(1).max(100).parse(username);
	const user = await findUserByField("username", normalizedUsername);

	if (!user) {
		throw new Error("User not found");
	}

	const matchRows = await loadUserProfileRows(user.id);
	return buildMiniProfileResponse(user, matchRows);
}

export async function updateMyProfile(userId: number, rawInput: unknown): Promise<ProfileResponse> {
	assertPositiveInteger(userId, "userId");
	const input = profileUpdateSchema.parse(rawInput);

	const data: Record<string, string | number> = {};

	if (input.avatarId !== undefined) {
		data.avatar_id = input.avatarId;
	}
	if (input.country !== undefined) {
		data.country = input.country.trim();
	}
	if (input.level !== undefined) {
		data.level = input.level;
	}
	if (input.xp !== undefined) {
		data.xp = input.xp;
	}
	if (input.nextLevelXp !== undefined) {
		data.next_level_xp = input.nextLevelXp;
	}
	if (input.playTimeHours !== undefined) {
		data.play_time_seconds = input.playTimeHours * 3600;
	}

	if (Object.keys(data).length === 0) {
		throw new Error("At least one profile field is required");
	}

	await prisma.users.update({
		where: { id: userId },
		data,
	});

	const refreshedUser = await findUserByField("id", userId);
	if (!refreshedUser) {
		throw new Error("User not found");
	}

	return buildProfileResponse(refreshedUser, await loadUserProfileRows(userId));
}
