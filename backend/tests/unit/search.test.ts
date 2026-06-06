import { afterEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("../../prisma/prisma", () => ({
	prisma: {
		users: {
			count: jest.fn(),
			findMany: jest.fn(),
		},
		friends: {
			findMany: jest.fn(),
		},
	},
}));

import { prisma } from "../../prisma/prisma";
import { searchUsers } from "../../prisma/search";

const mockedPrisma = prisma as any;

describe("search service", () => {
	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	test("searchUsers returns paginated matches and excludes existing connections", async () => {
		mockedPrisma.friends.findMany.mockResolvedValue([
			{ user_id: 7, friend_id: 2 },
			{ user_id: 3, friend_id: 7 },
		]);
		mockedPrisma.users.count.mockResolvedValue(1);
		mockedPrisma.users.findMany.mockResolvedValue([
			{ id: 11, username: "albert", avatar_id: 4 },
		]);

		const result = await searchUsers({
			term: "al",
			page: 2,
			limit: 10,
			requesterUserId: 7,
		});

		expect(mockedPrisma.friends.findMany).toHaveBeenCalledWith({
			where: { OR: [{ user_id: 7 }, { friend_id: 7 }] },
			select: { user_id: true, friend_id: true },
		});
		expect(mockedPrisma.users.count).toHaveBeenCalledWith({
			where: {
				AND: [
					{
						OR: [
							{ username: { contains: "al", mode: "insensitive" } },
							{ country: { contains: "al", mode: "insensitive" } },
						],
					},
					{ id: { notIn: [7, 2, 3] } },
				],
			},
		});
		expect(mockedPrisma.users.findMany).toHaveBeenCalledWith({
			where: {
				AND: [
					{
						OR: [
							{ username: { contains: "al", mode: "insensitive" } },
							{ country: { contains: "al", mode: "insensitive" } },
						],
					},
					{ id: { notIn: [7, 2, 3] } },
				],
			},
			orderBy: [{ username: "asc" }],
			skip: 10,
			take: 10,
			select: { id: true, username: true, avatar_id: true },
		});
		expect(result).toEqual({
			items: [{ id: 11, username: "albert", avatarId: 4, status: "offline" }],
			page: 2,
			limit: 10,
			total: 1,
			query: "al",
		});
	});

	test("searchUsers rejects empty queries", async () => {
		await expect(searchUsers({ term: "   " })).rejects.toThrow("Search query is required");
	});
});