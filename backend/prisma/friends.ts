import { prisma } from "./prisma";

/**
 * Friends table helpers keep API-level checks close to DB writes.
 */

export type FriendStatus = "pending" | "accepted" | "blocked";

export type FriendListStatus = FriendStatus | "all";

export type FriendRecord = {
	id: number;
	user_id: number;
	friend_id: number;
	status: FriendStatus | null;
	created_at: Date | null;
};

export type FriendIdentity = {
	id: number;
	username: string;
	avatar_id: number | null;
};

export type FriendListItem = FriendRecord & {
	users_friends_user_idTousers: FriendIdentity;
	users_friends_friend_idTousers: FriendIdentity;
};

export type PaginatedFriends = {
	items: FriendListItem[];
	page: number;
	limit: number;
	total: number;
};

export interface CreateFriendRequestInput {
	userId: number;
	friendId: number;
	status?: FriendStatus;
}

export interface UpdateFriendStatusInput {
	status: FriendStatus;
}

export interface ListFriendsOptions {
	userId: number;
	status?: FriendListStatus;
	page?: number;
	limit?: number;
}

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

function assertDifferentUsers(userId: number, friendId: number) {
	if (userId === friendId) {
		throw new Error("userId and friendId must be different");
	}
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

function friendshipSelect() {
	return {
		id: true,
		user_id: true,
		friend_id: true,
		status: true,
		created_at: true,
		users_friends_user_idTousers: {
			select: { id: true, username: true, avatar_id: true },
		},
		users_friends_friend_idTousers: {
			select: { id: true, username: true, avatar_id: true },
		},
	} as const;
}

/**
 * Create a friend request row.
 * - Validates user ids and self-friendship
 * - Ensures both users exist
 * - Prevents duplicate friendship pairs in both directions
 */
export async function createFriendRequest(rawInput: CreateFriendRequestInput): Promise<FriendRecord> {
	assertPositiveInteger(rawInput.userId, "userId");
	assertPositiveInteger(rawInput.friendId, "friendId");
	assertDifferentUsers(rawInput.userId, rawInput.friendId);

	const users = await prisma.users.findMany({
		where: {
			id: {
				in: [rawInput.userId, rawInput.friendId],
			},
		},
		select: {
			id: true,
		},
	});
	if (users.length !== 2) {
		throw new Error("User not found");
	}

	const existing = await prisma.friends.findFirst({
		where: {
			OR: [
				{
					user_id: rawInput.userId,
					friend_id: rawInput.friendId,
				},
				{
					user_id: rawInput.friendId,
					friend_id: rawInput.userId,
				},
			],
		},
		select: { id: true },
	});
	if (existing) {
		const friendship = await prisma.friends.findUnique({
			where: { id: existing.id },
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});

		if (!friendship) {
			throw new Error("Friend request already exists");
		}

		if (friendship.status === "blocked") {
			throw new Error("Friend request blocked");
		}

		if (friendship.status === "accepted") {
			throw new Error("Friendship already exists");
		}

		if (friendship.user_id === rawInput.userId && friendship.friend_id === rawInput.friendId) {
			throw new Error("Friend request already exists");
		}

		return prisma.friends.update({
			where: { id: friendship.id },
			data: { status: "accepted" },
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});
	}

	return prisma.friends.create({
		data: {
			user_id: rawInput.userId,
			friend_id: rawInput.friendId,
			...(rawInput.status ? { status: rawInput.status } : {}),
		},
		select: {
			id: true,
			user_id: true,
			friend_id: true,
			status: true,
			created_at: true,
		},
	});
}

export async function createBlockedRelation(userId: number, friendId: number): Promise<FriendRecord> {
	assertPositiveInteger(userId, "userId");
	assertPositiveInteger(friendId, "friendId");
	assertDifferentUsers(userId, friendId);

	const friendship = await getFriendshipByPair(userId, friendId);
	if (!friendship) {
		return prisma.friends.create({
			data: {
				user_id: userId,
				friend_id: friendId,
				status: "blocked",
			},
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});
	}

	return prisma.friends.update({
		where: { id: friendship.id },
		data: { status: "blocked" },
		select: {
			id: true,
			user_id: true,
			friend_id: true,
			status: true,
			created_at: true,
		},
	});
}

/**
 * Get one friendship by id with related user identities.
 */
export async function getFriendshipById(friendshipId: number) {
	assertPositiveInteger(friendshipId, "friendshipId");

	return prisma.friends.findUnique({
		where: { id: friendshipId },
		select: friendshipSelect(),
	});
}

/**
 * Get one friendship by user pair, treating A-B and B-A as the same relation.
 */
export async function getFriendshipByPair(userId: number, friendId: number) {
	assertPositiveInteger(userId, "userId");
	assertPositiveInteger(friendId, "friendId");

	return prisma.friends.findFirst({
		where: {
			OR: [
				{
					user_id: userId,
					friend_id: friendId,
				},
				{
					user_id: friendId,
					friend_id: userId,
				},
			],
		},
	});
}

/**
 * List friendships for a user.
 * Defaults to accepted relationships when status is omitted.
 */
export async function listFriends(options: ListFriendsOptions) {
	assertPositiveInteger(options.userId, "userId");
	const page = normalizePage(options.page);
	const limit = normalizeLimit(options.limit);
	const skip = (page - 1) * limit;
	const status = options.status ?? "accepted";
	const where = {
		OR: [{ user_id: options.userId }, { friend_id: options.userId }],
		...(status === "all" ? {} : { status }),
	};

	const [total, items] = await Promise.all([
		prisma.friends.count({ where }),
		prisma.friends.findMany({
			where,
			orderBy: {
				created_at: "desc",
			},
			skip,
			take: limit,
			select: friendshipSelect(),
		}),
	]);

	return {
		items,
		page,
		limit,
		total,
	};
}

export async function acceptFriendRequestById(friendshipId: number, requesterUserId: number) {
	assertPositiveInteger(requesterUserId, "requesterUserId");
	const friendship = await getFriendshipById(friendshipId);
	if (!friendship) {
		throw new Error("Friend request not found");
	}

	if (friendship.friend_id !== requesterUserId) {
		throw new Error("Not allowed to accept this friend request");
	}

	if (friendship.status !== "pending") {
		throw new Error("Friend request is not pending");
	}

	return updateFriendStatus(friendshipId, { status: "accepted" });
}

export async function rejectFriendRequestById(friendshipId: number, requesterUserId: number) {
	assertPositiveInteger(requesterUserId, "requesterUserId");
	const friendship = await getFriendshipById(friendshipId);
	if (!friendship) {
		throw new Error("Friend request not found");
	}

	if (friendship.friend_id !== requesterUserId) {
		throw new Error("Not allowed to reject this friend request");
	}

	return deleteFriendship(friendshipId);
}

export async function removeFriendshipByPair(userId: number, friendId: number) {
	assertPositiveInteger(userId, "userId");
	assertPositiveInteger(friendId, "friendId");
	assertDifferentUsers(userId, friendId);

	const friendship = await getFriendshipByPair(userId, friendId);
	if (!friendship) {
		throw new Error("Friendship not found");
	}

	return deleteFriendship(friendship.id);
}

export async function blockFriendshipByPair(userId: number, friendId: number) {
	return createBlockedRelation(userId, friendId);
}

/**
 * Update friendship status.
 */
export async function updateFriendStatus(friendshipId: number, rawInput: UpdateFriendStatusInput) {
	assertPositiveInteger(friendshipId, "friendshipId");

	return prisma.friends.update({
		where: { id: friendshipId },
		data: { status: rawInput.status },
		select: {
			id: true,
			user_id: true,
			friend_id: true,
			status: true,
			created_at: true,
		},
	});
}

/**
 * Convenience wrapper for accepting a friend request.
 */
export async function acceptFriendRequest(friendshipId: number) {
	return updateFriendStatus(friendshipId, { status: "accepted" });
}

/**
 * Convenience wrapper for blocking a friend request.
 */
export async function blockFriendRequest(friendshipId: number) {
	return updateFriendStatus(friendshipId, { status: "blocked" });
}

/**
 * Delete a friendship row by id.
 */
export async function deleteFriendship(friendshipId: number) {
	assertPositiveInteger(friendshipId, "friendshipId");

	return prisma.friends.delete({
		where: { id: friendshipId },
	});
}
