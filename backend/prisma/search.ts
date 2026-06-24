import { z } from "zod";
import { prisma } from "./prisma";

export type UserSearchEntry = {
	id: number;
	username: string;
	avatarId: number;
	status: "offline" | "blocked";
};

export type SearchUsersResponse = {
	items: UserSearchEntry[];
	page: number;
	limit: number;
	total: number;
	query: string;
};

export interface SearchUsersOptions {
	term: string;
	page?: number;
	limit?: number;
	requesterUserId?: number;
}

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

function normalizeSearchTerm(term: string) {
	const normalized = z.string().trim().max(100).parse(term);

	if (normalized.length === 0) {
		throw new Error("Search query is required");
	}

	return normalized;
}

function normalizePage(value: number | undefined) {
	if (value === undefined) {
		return 1;
	}

	assertPositiveInteger(value, "page");
	return value;
}

function normalizeLimit(value: number | undefined) {
	if (value === undefined) {
		return 20;
	}

	assertPositiveInteger(value, "limit");
	if (value > 50) {
		throw new Error("limit must be 50 or less");
	}

	return value;
}

async function loadExcludedUserIds(requesterUserId?: number) {
	if (!requesterUserId) {
		return [] as number[];
	}

	assertPositiveInteger(requesterUserId, "requesterUserId");

	const friendships = await prisma.friends.findMany({
		where: {
			OR: [{ user_id: requesterUserId }, { friend_id: requesterUserId }],
		},
		select: {
			user_id: true,
			friend_id: true,
		},
	});

	const excludedIds = new Set<number>([requesterUserId]);

	for (const friendship of friendships) {
		excludedIds.add(friendship.user_id);
		excludedIds.add(friendship.friend_id);
	}

	return Array.from(excludedIds);
}

export async function searchUsers(options: SearchUsersOptions): Promise<SearchUsersResponse> {
	const query = normalizeSearchTerm(options.term);
	const page = normalizePage(options.page);
	const limit = normalizeLimit(options.limit);
	const skip = (page - 1) * limit;
	const excludedUserIds = await loadExcludedUserIds(options.requesterUserId);

	const where = {
		AND: [
			{
				OR: [
					{ username: { contains: query, mode: "insensitive" as const } },
					{ country: { contains: query, mode: "insensitive" as const } },
				],
			},
			...(excludedUserIds.length > 0 ? [{ id: { notIn: excludedUserIds } }] : []),
		],
	};

	const [total, users] = await Promise.all([
		prisma.users.count({ where }),
		prisma.users.findMany({
			where,
			orderBy: [{ username: "asc" }],
			skip,
			take: limit,
			select: {
				id: true,
				username: true,
				avatar_id: true,
			},
		}),
	]);

	return {
		items: users.map((user: { id: number; username: string; avatar_id: number | null }) => ({
			id: user.id,
			username: user.username,
			avatarId: user.avatar_id ?? 0,
			status: "offline",
		})),
		page,
		limit,
		total,
		query,
	};
}
