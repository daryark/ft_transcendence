import { afterEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("../../prisma/notifications", () => ({
	createNotification: jest.fn(),
}));

jest.mock("../../notifications/hub", () => ({
	emitNotification: jest.fn(),
}));

import { emitNotification } from "../../notifications/hub";
import { notifyAchievementUnlocks } from "../../notifications/service";
import { createNotification } from "../../prisma/notifications";

const mockedCreateNotification = createNotification as jest.MockedFunction<
	typeof createNotification
>;
const mockedEmitNotification = emitNotification as jest.MockedFunction<
	typeof emitNotification
>;

describe("achievement notifications", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	test("persists and pushes each newly unlocked achievement", async () => {
		mockedCreateNotification.mockResolvedValue({
			id: 20,
			type: "achievement_unlocked",
			title: "Achievement unlocked: First Line",
			body: "Clear your first line.",
			link: "/channel/achievements",
			payload: { achievementId: 2, code: "first_line", rarity: "common" },
			isRead: false,
			createdAt: null,
			readAt: null,
			actor: null,
		});

		await notifyAchievementUnlocks(7, [
			{
				id: 2,
				code: "first_line",
				name: "First Line",
				description: "Clear your first line.",
				rarity: "common",
			},
		]);

		expect(mockedCreateNotification).toHaveBeenCalledWith({
			userId: 7,
			type: "achievement_unlocked",
			title: "Achievement unlocked: First Line",
			body: "Clear your first line.",
			link: "/channel/achievements",
			payload: {
				achievementId: 2,
				code: "first_line",
				rarity: "common",
			},
		});
		expect(mockedEmitNotification).toHaveBeenCalledWith(7, {
			notification: expect.objectContaining({ id: 20 }),
		});
	});
});
