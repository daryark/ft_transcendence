import { prisma } from "../prisma/prisma";
import { emitSocialUpdate } from "./realtime";

const onlineSocketsByUserId = new Map<number, Set<string>>();

function normalizeUserId(userId: number | string): number | null {
	const parsed = Number(userId);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isUserOnline(userId: number | string) {
	const normalizedUserId = normalizeUserId(userId);
	if (!normalizedUserId) return false;

	return (onlineSocketsByUserId.get(normalizedUserId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(userIds: Array<number | string>) {
	return userIds
		.map(normalizeUserId)
		.filter((userId): userId is number => userId !== null)
		.filter(isUserOnline);
}

async function loadPresencePayload(userId: number, online: boolean) {
	const [user, friendships] = await Promise.all([
		prisma.users.findUnique({
			where: { id: userId },
			select: { username: true },
		}),
		prisma.friends.findMany({
			where: {
				status: "accepted",
				OR: [{ user_id: userId }, { friend_id: userId }],
			},
			select: { user_id: true, friend_id: true },
		}),
	]);

	const friendIds = friendships.map((friendship) =>
		friendship.user_id === userId ? friendship.friend_id : friendship.user_id,
	);

	return {
		friendIds,
		payload: {
			action: "presence",
			userId,
			username: user?.username ?? `User${userId}`,
			online,
		},
	};
}

async function emitPresenceToFriends(userId: number, online: boolean) {
	try {
		const { friendIds, payload } = await loadPresencePayload(userId, online);
		emitSocialUpdate(friendIds, payload);
	} catch (error) {
		console.error("Failed to emit presence update", error);
	}
}

export function markUserSocketOnline(userId: number | string, socketId: string) {
	const normalizedUserId = normalizeUserId(userId);
	if (!normalizedUserId) return;

	const sockets = onlineSocketsByUserId.get(normalizedUserId) ?? new Set<string>();
	const wasOffline = sockets.size === 0;
	sockets.add(socketId);
	onlineSocketsByUserId.set(normalizedUserId, sockets);

	if (wasOffline) {
		void emitPresenceToFriends(normalizedUserId, true);
	}
}

export function markUserSocketOffline(userId: number | string, socketId: string) {
	const normalizedUserId = normalizeUserId(userId);
	if (!normalizedUserId) return;

	const sockets = onlineSocketsByUserId.get(normalizedUserId);
	if (!sockets) return;

	sockets.delete(socketId);
	if (sockets.size > 0) return;

	onlineSocketsByUserId.delete(normalizedUserId);
	void emitPresenceToFriends(normalizedUserId, false);
}

export function emitPresenceSnapshot(userId: number | string, friendIds: Array<number | string>) {
	const normalizedUserId = normalizeUserId(userId);
	if (!normalizedUserId) return;

	const statuses = getOnlineUserIds(friendIds).map((friendId) => ({
		userId: friendId,
		online: true,
	}));

	emitSocialUpdate([normalizedUserId], {
		action: "presence:snapshot",
		statuses,
	});
}
