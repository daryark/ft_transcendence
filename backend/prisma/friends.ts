import { prisma } from "./prisma";

export type FriendStatus = "pending" | "accepted" | "blocked";

export type FriendRecord = {
	id: number;
	user_id: number;
	friend_id: number;
	status: FriendStatus | null;
	created_at: Date | null;
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
	status?: FriendStatus;
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
		throw new Error("Friend request already exists");
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

export async function getFriendshipById(friendshipId: number) {
	assertPositiveInteger(friendshipId, "friendshipId");

	return prisma.friends.findUnique({
		where: { id: friendshipId },
		include: {
			users_friends_user_idTousers: {
				select: { id: true, username: true },
			},
			users_friends_friend_idTousers: {
				select: { id: true, username: true },
			},
		},
	});
}

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

export async function listFriends(options: ListFriendsOptions) {
	assertPositiveInteger(options.userId, "userId");

	return prisma.friends.findMany({
		where: {
			status: options.status ?? "accepted",
			OR: [{ user_id: options.userId }, { friend_id: options.userId }],
		},
		orderBy: {
			created_at: "desc",
		},
	});
}

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

export async function acceptFriendRequest(friendshipId: number) {
	return updateFriendStatus(friendshipId, { status: "accepted" });
}

export async function blockFriendRequest(friendshipId: number) {
	return updateFriendStatus(friendshipId, { status: "blocked" });
}

export async function deleteFriendship(friendshipId: number) {
	assertPositiveInteger(friendshipId, "friendshipId");

	return prisma.friends.delete({
		where: { id: friendshipId },
	});
}
