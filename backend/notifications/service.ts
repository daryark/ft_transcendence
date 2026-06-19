import { createNotification } from "../prisma/notifications";
import { emitNotification } from "./hub";

export type NotificationInput = {
	actorId?: number | null;
	type: string;
	title: string;
	body: string;
	link?: string | null;
	payload?: unknown;
};

export type AchievementNotification = {
	id: number;
	code: string;
	name: string;
	description: string;
	rarity: string;
};

export async function notifyUser(userId: number, input: NotificationInput) {
	try {
		const notification = await createNotification({ userId, ...input });
		emitNotification(userId, { notification });
		return notification;
	} catch (error) {
		console.error("Failed to create notification", error);
		return null;
	}
}

export async function notifyAchievementUnlocks(
	userId: number,
	achievements: AchievementNotification[],
) {
	if (achievements.length === 0) return;

	await Promise.allSettled(
		achievements.map((achievement) =>
			notifyUser(userId, {
				type: "achievement_unlocked",
				title: `Achievement unlocked: ${achievement.name}`,
				body: achievement.description,
				link: "/channel/achievements",
				payload: {
					achievementId: achievement.id,
					code: achievement.code,
					rarity: achievement.rarity,
				},
			}),
		),
	);
}
