import { afterEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("../../prisma/prisma", () => ({
	prisma: {
		users: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		match_players: {
			findMany: jest.fn(),
		},
	},
}));

import { prisma } from "../../prisma/prisma";
import { getProfileByUsername, updateMyProfile } from "../../prisma/profile";

const mockedPrisma = prisma as any;

describe("profile service", () => {
	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	test("getProfileByUsername falls back when country is unavailable and maps stats", async () => {
		const now = new Date("2026-06-02T12:00:00.000Z").getTime();
		jest.spyOn(Date, "now").mockReturnValue(now);

		const userRecord = {
			id: 12,
			username: "alice",
			avatar_id: 4,
			created_at: new Date("2026-05-10T12:00:00.000Z"),
			level: 9,
			xp: 420,
			next_level_xp: 1000,
			play_time_seconds: 7200,
			wins: null,
		};

		mockedPrisma.users.findUnique.mockImplementation(({ select }: { select?: Record<string, unknown> }) => {
			if (select && "country" in select) {
				throw new Error("Unknown field `country`");
			}

			return Promise.resolve(userRecord);
		});

		mockedPrisma.match_players.findMany.mockResolvedValue([
			{
				score: 18,
				metric_value: 18.5,
				result: "lose",
				matches: {
					gamemode: "quickPlay",
					created_at: new Date("2026-05-31T12:00:00.000Z"),
				},
			},
			{
				score: 34,
				metric_value: 34.25,
				result: "win",
				matches: {
					gamemode: "quickPlay",
					created_at: new Date("2026-05-30T12:00:00.000Z"),
				},
			},
			{
				score: 38000,
				metric_value: null,
				result: "win",
				matches: {
					gamemode: "fortyLines",
					created_at: new Date("2026-05-27T12:00:00.000Z"),
				},
			},
			{
				score: 41000,
				metric_value: null,
				result: "win",
				matches: {
					gamemode: "fortyLines",
					created_at: new Date("2026-05-26T12:00:00.000Z"),
				},
			},
			{
				score: 60,
				metric_value: null,
				result: "win",
				matches: {
					gamemode: "blitz",
					created_at: new Date("2026-06-01T12:00:00.000Z"),
				},
			},
			...Array.from({ length: 12 }, (_, index) => ({
				score: 100 + index,
				metric_value: null,
				result: "lose",
				matches: {
					gamemode: "blitz",
					created_at: new Date(`2026-05-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
				},
			})),
			{
				score: 1200,
				metric_value: null,
				result: "win",
				matches: {
					gamemode: "customGame",
					created_at: new Date("2026-05-29T12:00:00.000Z"),
				},
			},
			{
				score: 1100,
				metric_value: null,
				result: "lose",
				matches: {
					gamemode: "customGame",
					created_at: new Date("2026-05-28T12:00:00.000Z"),
				},
			},
		]);

		const profile = await getProfileByUsername("alice");

		expect(profile).toMatchObject({
			id: 12,
			username: "alice",
			country: undefined,
			avatarId: 4,
			level: 9,
			xp: 420,
			nextLevelXp: 1000,
			playTimeHours: 2,
			onlineGames: 4,
			wins: 2,
			modes: {
				quickPlay: { value: "34.25 m", achievedAgo: "3 days ago" },
				fortyLines: { value: "0:38.000", achievedAgo: "6 days ago" },
				blitz: { value: "111 pts", achievedAgo: "21 days ago" },
				zen: null,
			},
		});

		expect(mockedPrisma.match_players.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					user_id: 12,
					matches: {
						status: "finished",
					},
				},
			}),
		);
		expect(profile.topGames.quickPlay.map((game) => game.value)).toEqual([
			"34.25 m",
			"18.5 m",
		]);
		expect(profile.topGames.fortyLines.map((game) => game.value)).toEqual([
			"0:38.000",
			"0:41.000",
		]);
		expect(profile.topGames.blitz).toHaveLength(10);
		expect(profile.topGames.blitz.map((game) => game.value)).toEqual([
			"111 pts",
			"110 pts",
			"109 pts",
			"108 pts",
			"107 pts",
			"106 pts",
			"105 pts",
			"104 pts",
			"103 pts",
			"102 pts",
		]);
	});

	test("updateMyProfile writes profile fields and returns refreshed data", async () => {
		mockedPrisma.users.update.mockResolvedValue({ id: 7 });
		mockedPrisma.users.findUnique.mockResolvedValue({
			id: 7,
			username: "bob",
			country: "Poland",
			avatar_id: 2,
			created_at: new Date("2026-01-01T00:00:00.000Z"),
			level: 5,
			xp: 150,
			next_level_xp: 500,
			play_time_seconds: 10800,
			wins: 4,
		});
		mockedPrisma.match_players.findMany.mockResolvedValue([]);

		const profile = await updateMyProfile(7, {
			avatarId: 8,
			country: "  Poland  ",
			playTimeHours: 5,
		});

		expect(mockedPrisma.users.update).toHaveBeenCalledWith({
			where: { id: 7 },
			data: {
				avatar_id: 8,
				country: "Poland",
				play_time_seconds: 18000,
			},
		});
		expect(profile).toMatchObject({
			id: 7,
			username: "bob",
			country: "Poland",
			avatarId: 2,
			playTimeHours: 3,
			onlineGames: 0,
			wins: 0,
		});
	});
});
