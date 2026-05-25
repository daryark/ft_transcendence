import { z } from "zod";
import { prisma } from "./prisma";

const updateProfileSchema = z
	.object({
		avatarId: z.number().int().min(0).optional(),
		country: z.string().trim().min(1).max(100).optional(),
		level: z.number().int().min(1).optional(),
		xp: z.number().int().min(0).optional(),
		nextLevelXp: z.number().int().min(1).optional(),
		playTimeHours: z.number().int().min(0).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one profile field is required",
	});

export type ProfileModeStats = {
	value: string;
	achievedAgo?: string;
} | null;

export type ProfileResponse = {
	id: number;
	username: string;
	country: string;
	avatarId: number;
	created_at: Date | null;
	level: number;
	xp: number;
	nextLevelXp: number;
	playTimeHours: number;
	onlineGames: number;
	wins: number;
	modes: {
		league: { tr: number; glicko: number; rank: string } | null;
		quickPlay: ProfileModeStats;
		fortyLines: ProfileModeStats;
		blitz: ProfileModeStats;
		zen: ProfileModeStats;
	};
};

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

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

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

function toProfileResponse(
	user: ProfileUserRecord,
	stats: {
	onlineGames: number;
	wins: number;
	modeStats: Record<string, ProfileModeStats>;
},
): ProfileResponse {
	return {
		id: user.id,
		username: user.username,
		country: user.country ?? "Undefined",
		avatarId: user.avatar_id ?? 0,
		created_at: user.created_at ?? null,
		level: user.level ?? 1,
		xp: user.xp ?? 0,
		nextLevelXp: user.next_level_xp ?? 100,
		playTimeHours: Math.floor((user.play_time_seconds ?? 0) / 3600),
		onlineGames: stats.onlineGames,
		wins: stats.wins,
		modes: {
			league: null,
			quickPlay: stats.modeStats.quickPlay ?? null,
			fortyLines: stats.modeStats.fortyLines ?? null,
			blitz: stats.modeStats.blitz ?? null,
			zen: stats.modeStats.zen ?? null,
		},
	};
}

function formatAchievedAgo(achievedAt: Date | null): string | undefined {
	if (!achievedAt) {
		return undefined;
	}

	const diffMs = Date.now() - achievedAt.getTime();
	const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	return days > 0 ? `${days} days ago` : "recently";
}

function modeKeyFromDbMode(mode: string | null | undefined): string | null {
	switch (mode) {
		case "quickPlay":
			return "quickPlay";
		case "fortyLines":
			return "fortyLines";
		case "blitz":
			return "blitz";
		case "zen":
			return "zen";
		default:
			return null;
	}
}

async function findProfileUserByUsername(username: string) {
	try {
		return await prisma.users.findUnique({
			where: { username },
			select: {
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
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("Unknown field `country`")) {
			throw error;
		}

		return await prisma.users.findUnique({
			where: { username },
			select: {
				id: true,
				username: true,
				avatar_id: true,
				created_at: true,
				level: true,
				xp: true,
				next_level_xp: true,
				play_time_seconds: true,
				wins: true,
			},
		});
	}
}

async function findProfileUserById(userId: number) {
	try {
		return await prisma.users.findUnique({
			where: { id: userId },
			select: {
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
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes("Unknown field `country`")) {
			throw error;
		}

		return await prisma.users.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				avatar_id: true,
				created_at: true,
				level: true,
				xp: true,
				next_level_xp: true,
				play_time_seconds: true,
				wins: true,
			},
		});
	}
}

/**
 * Fetch a user's public profile and game stats by username.
 */
export async function getProfileByUsername(username: string): Promise<ProfileResponse> {
	const normalizedUsername = z.string().trim().min(1).max(100).parse(username);

	const user = await findProfileUserByUsername(normalizedUsername);

	if (!user) {
		throw new Error("User not found");
	}

	const matchPlayers = await prisma.match_players.findMany({
		where: { user_id: user.id },
		include: {
			matches: {
				select: {
					gamemode: true,
					created_at: true,
				},
			},
		},
	});

	const wins = await prisma.match_players.count({
		where: { user_id: user.id, result: "win" },
	});

	const modeStats: Record<string, { score: number; achievedAt: Date | null }> = {};

	for (const matchPlayer of matchPlayers) {
		const key = modeKeyFromDbMode(matchPlayer.matches?.gamemode);
		if (!key) {
			continue;
		}

		const score = typeof matchPlayer.score === "number" ? matchPlayer.score : 0;
		const existing = modeStats[key];
		if (!existing || score > existing.score) {
			modeStats[key] = {
				score,
				achievedAt: matchPlayer.matches?.created_at ?? null,
			};
		}
	}

	return toProfileResponse(user, {
		onlineGames: matchPlayers.length,
		wins,
		modeStats: {
			quickPlay: modeStats.quickPlay ? { value: String(modeStats.quickPlay.score), achievedAgo: formatAchievedAgo(modeStats.quickPlay.achievedAt) } : null,
			fortyLines: modeStats.fortyLines ? { value: String(modeStats.fortyLines.score), achievedAgo: formatAchievedAgo(modeStats.fortyLines.achievedAt) } : null,
			blitz: modeStats.blitz ? { value: String(modeStats.blitz.score), achievedAgo: formatAchievedAgo(modeStats.blitz.achievedAt) } : null,
			zen: modeStats.zen ? { value: String(modeStats.zen.score), achievedAgo: formatAchievedAgo(modeStats.zen.achievedAt) } : null,
		},
	});
}

/**
 * Update the authenticated user's profile fields.
 */
export async function updateMyProfile(userId: number, rawInput: unknown): Promise<ProfileResponse> {
	assertPositiveInteger(userId, "userId");
	const input = updateProfileSchema.parse(rawInput);

	const data: Record<string, number | string> = {};
	if (typeof input.avatarId === "number") data.avatar_id = input.avatarId;
	if (typeof input.country === "string") data.country = input.country;
	if (typeof input.level === "number") data.level = input.level;
	if (typeof input.xp === "number") data.xp = input.xp;
	if (typeof input.nextLevelXp === "number") data.next_level_xp = input.nextLevelXp;
	if (typeof input.playTimeHours === "number") data.play_time_seconds = input.playTimeHours * 3600;

	if (Object.keys(data).length === 0) {
		throw new Error("No valid fields to update");
	}

	const updated = await prisma.users.update({
		where: { id: userId },
		data,
	});

	const refreshed = await findProfileUserById(updated.id);
	if (!refreshed) {
		throw new Error("User not found");
	}

	return toProfileResponse(refreshed, {
		onlineGames: 0,
		wins: refreshed.wins ?? 0,
		modeStats: {},
	});
}
