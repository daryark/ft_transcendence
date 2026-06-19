import { prisma } from "./prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const MAX_CONTENT_LENGTH = 2000;

export type MessageStatus = "sent" | "read";

export type MessageItem = {
	id: number;
	senderId: number;
	receiverId: number;
	content: string;
	replyToId: number | null;
	status: MessageStatus;
	createdAt: string | null;
	readAt: string | null;
};

export type PaginatedConversation = {
	items: MessageItem[];
	page: number;
	limit: number;
	total: number;
	nextCursor: number | null;
};

export interface SendMessageInput {
	senderId: number;
	receiverId: number;
	content: string;
	replyToId?: number;
}

export interface ListConversationOptions {
	page?: number;
	limit?: number;
	cursor?: number;
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
	if (value === undefined) return DEFAULT_LIMIT;
	assertPositiveInteger(value, "limit");
	if (value > MAX_LIMIT) {
		throw new Error(`limit must be ${MAX_LIMIT} or less`);
	}
	return value;
}

function normalizeContent(content: unknown) {
	if (typeof content !== "string") {
		throw new Error("content must be a string");
	}

	const normalized = content
		.normalize("NFC")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
		.trim();

	if (!normalized) {
		throw new Error("content must not be empty");
	}
	if (normalized.length > MAX_CONTENT_LENGTH) {
		throw new Error(`content must be ${MAX_CONTENT_LENGTH} characters or less`);
	}
	return normalized;
}

function conversationWhere(userAId: number, userBId: number) {
	return {
		OR: [
			{ sender_id: userAId, receiver_id: userBId },
			{ sender_id: userBId, receiver_id: userAId },
		],
	};
}

function friendshipWhere(userAId: number, userBId: number) {
	return {
		OR: [
			{ user_id: userAId, friend_id: userBId },
			{ user_id: userBId, friend_id: userAId },
		],
	};
}

function messageSelect() {
	return {
		id: true,
		sender_id: true,
		receiver_id: true,
		content: true,
		reply_to_id: true,
		created_at: true,
		read_at: true,
	} as const;
}

function serializeMessage(message: {
	id: number;
	sender_id: number;
	receiver_id: number;
	content: string;
	reply_to_id: number | null;
	created_at: Date | null;
	read_at: Date | null;
}): MessageItem {
	return {
		id: message.id,
		senderId: message.sender_id,
		receiverId: message.receiver_id,
		content: message.content,
		replyToId: message.reply_to_id,
		status: message.read_at ? "read" : "sent",
		createdAt: message.created_at?.toISOString() ?? null,
		readAt: message.read_at?.toISOString() ?? null,
	};
}

async function assertUsersCanMessage(userAId: number, userBId: number) {
	assertPositiveInteger(userAId, "userId");
	assertPositiveInteger(userBId, "friendId");
	if (userAId === userBId) {
		throw new Error("Users must be different");
	}

	const users = await prisma.users.count({
		where: { id: { in: [userAId, userBId] } },
	});
	if (users !== 2) {
		throw new Error("User not found");
	}

	const friendship = await prisma.friends.findFirst({
		where: friendshipWhere(userAId, userBId),
		select: { status: true },
	});

	if (!friendship) {
		throw new Error("Users are not friends");
	}
	if (friendship.status === "blocked") {
		throw new Error("Messaging is blocked");
	}
	if (friendship.status !== "accepted") {
		throw new Error("Friend request must be accepted before messaging");
	}
}

export async function sendMessage(rawInput: SendMessageInput): Promise<MessageItem> {
	assertPositiveInteger(rawInput.senderId, "senderId");
	assertPositiveInteger(rawInput.receiverId, "receiverId");
	await assertUsersCanMessage(rawInput.senderId, rawInput.receiverId);

	const content = normalizeContent(rawInput.content);
	let replyToId: number | null = null;

	if (rawInput.replyToId !== undefined) {
		assertPositiveInteger(rawInput.replyToId, "replyTo");
		const reply = await prisma.messages.findFirst({
			where: {
				id: rawInput.replyToId,
				...conversationWhere(rawInput.senderId, rawInput.receiverId),
			},
			select: { id: true },
		});
		if (!reply) {
			throw new Error("Reply message not found in this conversation");
		}
		replyToId = reply.id;
	}

	const message = await prisma.messages.create({
		data: {
			sender_id: rawInput.senderId,
			receiver_id: rawInput.receiverId,
			content,
			reply_to_id: replyToId,
		},
		select: messageSelect(),
	});

	return serializeMessage(message);
}

export async function getMessageById(messageId: number) {
	assertPositiveInteger(messageId, "messageId");

	return prisma.messages.findUnique({
		where: { id: messageId },
		include: {
			users_messages_sender_idTousers: {
				select: { id: true, username: true },
			},
			users_messages_receiver_idTousers: {
				select: { id: true, username: true },
			},
		},
	});
}

export async function listConversation(
	userAId: number,
	userBId: number,
	options: ListConversationOptions = {},
): Promise<PaginatedConversation> {
	await assertUsersCanMessage(userAId, userBId);
	const page = normalizePage(options.page);
	const limit = normalizeLimit(options.limit);
	const where = conversationWhere(userAId, userBId);

	if (options.cursor !== undefined) {
		assertPositiveInteger(options.cursor, "cursor");
		const cursorMessage = await prisma.messages.findFirst({
			where: { id: options.cursor, ...where },
			select: { id: true },
		});
		if (!cursorMessage) {
			throw new Error("cursor does not belong to this conversation");
		}
	}

	const [total, rows] = await Promise.all([
		prisma.messages.count({ where }),
		prisma.messages.findMany({
			where,
			orderBy: { id: "desc" },
			...(options.cursor
				? { cursor: { id: options.cursor }, skip: 1 }
				: { skip: (page - 1) * limit }),
			take: limit + 1,
			select: messageSelect(),
		}),
	]);

	const hasMore = rows.length > limit;
	const pageRows = rows.slice(0, limit);
	const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

	return {
		items: pageRows.reverse().map(serializeMessage),
		page,
		limit,
		total,
		nextCursor,
	};
}

export async function markMessageRead(messageId: number, userId: number): Promise<MessageItem> {
	assertPositiveInteger(messageId, "messageId");
	assertPositiveInteger(userId, "userId");

	const message = await prisma.messages.findFirst({
		where: { id: messageId, receiver_id: userId },
		select: { id: true },
	});
	if (!message) {
		throw new Error("Message not found");
	}

	const updated = await prisma.messages.update({
		where: { id: messageId },
		data: { read_at: new Date() },
		select: messageSelect(),
	});
	return serializeMessage(updated);
}

export async function markConversationRead(userId: number, friendId: number) {
	await assertUsersCanMessage(userId, friendId);
	const readAt = new Date();
	const result = await prisma.messages.updateMany({
		where: {
			sender_id: friendId,
			receiver_id: userId,
			read_at: null,
		},
		data: { read_at: readAt },
	});

	return { count: result.count, readAt: readAt.toISOString() };
}

export async function listUserMessages(userId: number, limit = 100) {
	assertPositiveInteger(userId, "userId");
	assertPositiveInteger(limit, "limit");

	return prisma.messages.findMany({
		where: {
			OR: [{ sender_id: userId }, { receiver_id: userId }],
		},
		orderBy: { created_at: "desc" },
		take: limit,
	});
}

export async function deleteMessage(messageId: number) {
	assertPositiveInteger(messageId, "messageId");
	return prisma.messages.delete({ where: { id: messageId } });
}
