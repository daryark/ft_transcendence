import { prisma } from "./prisma";

export type NotificationActor = {
	id: number;
	username: string;
	avatar_id: number | null;
};

export type NotificationRecord = {
	id: number;
	user_id: number;
	actor_id: number | null;
	type: string;
	title: string;
	body: string;
	link: string | null;
	payload: unknown;
	is_read: boolean;
	created_at: Date | null;
	read_at: Date | null;
	users_notifications_actor_idTousers: NotificationActor | null;
};

export type NotificationListItem = {
	id: number;
	type: string;
	title: string;
	body: string;
	link: string | null;
	payload: unknown;
	isRead: boolean;
	createdAt: string | null;
	readAt: string | null;
	actor: NotificationActor | null;
};

export type PaginatedNotifications = {
	items: NotificationListItem[];
	page: number;
	limit: number;
	total: number;
};

export interface CreateNotificationInput {
	userId: number;
	actorId?: number | null;
	type: string;
	title: string;
	body: string;
	link?: string | null;
	payload?: unknown;
}

export interface ListNotificationsOptions {
	userId: number;
	page?: number;
	limit?: number;
}

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

function normalizePage(value: number | undefined) {
	if (value === undefined) return 1;
	assertPositiveInteger(value, "page");
	return value;
}

function normalizeLimit(value: number | undefined) {
	if (value === undefined) return 20;
	assertPositiveInteger(value, "limit");
	if (value > 50) throw new Error("limit must be 50 or less");
	return value;
}

function notificationSelect() {
	return {
		id: true,
		user_id: true,
		actor_id: true,
		type: true,
		title: true,
		body: true,
		link: true,
		payload: true,
		is_read: true,
		created_at: true,
		read_at: true,
		users_notifications_actor_idTousers: {
			select: { id: true, username: true, avatar_id: true },
		},
	} as const;
}

function serializeNotification(notification: NotificationRecord): NotificationListItem {
	return {
		id: notification.id,
		type: notification.type,
		title: notification.title,
		body: notification.body,
		link: notification.link,
		payload: notification.payload,
		isRead: notification.is_read,
		createdAt: notification.created_at ? notification.created_at.toISOString() : null,
		readAt: notification.read_at ? notification.read_at.toISOString() : null,
		actor: notification.users_notifications_actor_idTousers ?? null,
	};
}

export async function createNotification(rawInput: CreateNotificationInput): Promise<NotificationListItem> {
	assertPositiveInteger(rawInput.userId, "userId");
	if (rawInput.actorId !== undefined && rawInput.actorId !== null) {
		assertPositiveInteger(rawInput.actorId, "actorId");
	}

	const usersToCheck = new Set<number>([rawInput.userId]);
	if (rawInput.actorId) usersToCheck.add(rawInput.actorId);

	const existingUsers = await prisma.users.findMany({
		where: { id: { in: Array.from(usersToCheck) } },
		select: { id: true },
	});

	if (existingUsers.length !== usersToCheck.size) {
		throw new Error("User not found");
	}

	const notification = (await prisma.notifications.create({
		data: {
			user_id: rawInput.userId,
			actor_id: rawInput.actorId ?? null,
			type: rawInput.type,
			title: rawInput.title,
			body: rawInput.body,
			link: rawInput.link ?? null,
			payload: rawInput.payload as never,
		},
		select: notificationSelect(),
	})) as NotificationRecord;

	return serializeNotification(notification);
}

export async function listNotifications(options: ListNotificationsOptions): Promise<PaginatedNotifications> {
	assertPositiveInteger(options.userId, "userId");
	const page = normalizePage(options.page);
	const limit = normalizeLimit(options.limit);
	const skip = (page - 1) * limit;
	const where = { user_id: options.userId };

	const [total, items] = await Promise.all([
		prisma.notifications.count({ where }),
		prisma.notifications.findMany({
			where,
			orderBy: { created_at: "desc" },
			skip,
			take: limit,
			select: notificationSelect(),
		}),
	]);

	return {
		items: items.map((item) => serializeNotification(item as NotificationRecord)),
		page,
		limit,
		total,
	};
}

export async function markNotificationRead(notificationId: number, userId: number): Promise<NotificationListItem> {
	assertPositiveInteger(notificationId, "notificationId");
	assertPositiveInteger(userId, "userId");

	const notification = await prisma.notifications.findFirst({
		where: { id: notificationId, user_id: userId },
		select: notificationSelect(),
	});

	if (!notification) {
		throw new Error("Notification not found");
	}

	const updated = (await prisma.notifications.update({
		where: { id: notificationId },
		data: { is_read: true, read_at: new Date() },
		select: notificationSelect(),
	})) as NotificationRecord;

	return serializeNotification(updated);
}

export async function markAllNotificationsRead(userId: number): Promise<{ count: number }> {
	assertPositiveInteger(userId, "userId");

	const result = await prisma.notifications.updateMany({
		where: { user_id: userId, is_read: false },
		data: { is_read: true, read_at: new Date() },
	});

	return { count: result.count };
}
