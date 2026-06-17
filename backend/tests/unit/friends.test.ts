import { afterEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("../../prisma/prisma", () => ({
	prisma: {
		users: {
			findMany: jest.fn(),
		},
		friends: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findMany: jest.fn(),
			count: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	},
}));

import { prisma } from "../../prisma/prisma";
import {
	acceptFriendRequestById,
	blockFriendshipByPair,
	createFriendRequest,
	listFriends,
	removeFriendshipByPair,
} from "../../prisma/friends";

const mockedPrisma = prisma as any;

describe("friends service", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	test("createFriendRequest creates a pending row for two existing users", async () => {
		mockedPrisma.users.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
		mockedPrisma.friends.findFirst.mockResolvedValue(null);
		mockedPrisma.friends.create.mockResolvedValue({
			id: 10,
			user_id: 1,
			friend_id: 2,
			status: "pending",
			created_at: null,
		});

		const result = await createFriendRequest({ userId: 1, friendId: 2 });

		expect(result).toEqual({
			id: 10,
			user_id: 1,
			friend_id: 2,
			status: "pending",
			created_at: null,
		});
		expect(mockedPrisma.friends.create).toHaveBeenCalledWith({
			data: { user_id: 1, friend_id: 2 },
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});
	});

	test("createFriendRequest accepts a reciprocal pending request", async () => {
		mockedPrisma.users.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
		mockedPrisma.friends.findFirst.mockResolvedValue({ id: 33 });
		mockedPrisma.friends.findUnique.mockResolvedValue({
			id: 33,
			user_id: 2,
			friend_id: 1,
			status: "pending",
			created_at: null,
		});
		mockedPrisma.friends.update.mockResolvedValue({
			id: 33,
			user_id: 2,
			friend_id: 1,
			status: "accepted",
			created_at: null,
		});

		const result = await createFriendRequest({ userId: 1, friendId: 2 });

		expect(result.status).toBe("accepted");
		expect(mockedPrisma.friends.update).toHaveBeenCalledWith({
			where: { id: 33 },
			data: { status: "accepted" },
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});
	});

	test("listFriends returns paginated friendships", async () => {
		mockedPrisma.friends.count.mockResolvedValue(1);
		mockedPrisma.friends.findMany.mockResolvedValue([
			{
				id: 7,
				user_id: 1,
				friend_id: 2,
				status: "accepted",
				created_at: null,
				users_friends_user_idTousers: { id: 1, username: "alice", avatar_id: 1 },
				users_friends_friend_idTousers: { id: 2, username: "bob", avatar_id: 2 },
			},
		]);

		const result = await listFriends({ userId: 1, status: "all", page: 2, limit: 10 });

		expect(result).toEqual({
			items: [
				{
					id: 7,
					user_id: 1,
					friend_id: 2,
					status: "accepted",
					created_at: null,
					users_friends_user_idTousers: { id: 1, username: "alice", avatar_id: 1 },
					users_friends_friend_idTousers: { id: 2, username: "bob", avatar_id: 2 },
				},
			],
			page: 2,
			limit: 10,
			total: 1,
		});
		expect(mockedPrisma.friends.count).toHaveBeenCalledWith({
			where: { OR: [{ user_id: 1 }, { friend_id: 1 }] },
		});
	});

	test("blockFriendshipByPair creates or updates the blocked relation", async () => {
		mockedPrisma.friends.findFirst.mockResolvedValue(null);
		mockedPrisma.friends.findUnique.mockResolvedValue(null);
		mockedPrisma.friends.create.mockResolvedValue({
			id: 55,
			user_id: 1,
			friend_id: 9,
			status: "blocked",
			created_at: null,
		});

		await blockFriendshipByPair(1, 9);

		expect(mockedPrisma.friends.create).toHaveBeenCalledWith({
			data: { user_id: 1, friend_id: 9, status: "blocked" },
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});
	});

	test("blockFriendshipByPair keeps the blocker as user_id when updating reverse rows", async () => {
		mockedPrisma.friends.findFirst.mockResolvedValue({
			id: 56,
			user_id: 9,
			friend_id: 1,
			status: "accepted",
		});
		mockedPrisma.friends.update.mockResolvedValue({
			id: 56,
			user_id: 1,
			friend_id: 9,
			status: "blocked",
			created_at: null,
		});

		await blockFriendshipByPair(1, 9);

		expect(mockedPrisma.friends.update).toHaveBeenCalledWith({
			where: { id: 56 },
			data: { user_id: 1, friend_id: 9, status: "blocked" },
			select: {
				id: true,
				user_id: true,
				friend_id: true,
				status: true,
				created_at: true,
			},
		});
	});

	test("removeFriendshipByPair deletes the matching friendship", async () => {
		mockedPrisma.friends.findFirst.mockResolvedValue({ id: 88 });
		mockedPrisma.friends.delete.mockResolvedValue({ id: 88 });

		await removeFriendshipByPair(1, 2);

		expect(mockedPrisma.friends.delete).toHaveBeenCalledWith({ where: { id: 88 } });
	});

	test("removeFriendshipByPair does not let the blocked user unblock themselves", async () => {
		mockedPrisma.friends.findFirst.mockResolvedValue({
			id: 89,
			user_id: 2,
			friend_id: 1,
			status: "blocked",
		});

		await expect(removeFriendshipByPair(1, 2)).rejects.toThrow("Not allowed");
		expect(mockedPrisma.friends.delete).not.toHaveBeenCalled();
	});

	test("acceptFriendRequestById only allows the recipient to accept", async () => {
		mockedPrisma.friends.findUnique.mockResolvedValue({
			id: 90,
			user_id: 1,
			friend_id: 2,
			status: "pending",
			created_at: null,
		});
		mockedPrisma.friends.update.mockResolvedValue({
			id: 90,
			user_id: 1,
			friend_id: 2,
			status: "accepted",
			created_at: null,
		});

		await expect(acceptFriendRequestById(90, 2)).resolves.toMatchObject({ status: "accepted" });
		await expect(acceptFriendRequestById(90, 3)).rejects.toThrow("Not allowed");
	});
});
