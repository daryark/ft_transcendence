import { prisma } from "./prisma";

export type MessageRecord = {
	id: number;
	sender_id: number;
	receiver_id: number;
	content: string;
	created_at: Date | null;
};

export interface SendMessageInput {
	senderId: number;
	receiverId: number;
	content: string;
}

export interface ListConversationOptions {
	limit?: number;
}

function assertPositiveInteger(value: number, label: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer`);
	}
}

function normalizeContent(content: string) {
	const trimmed = content.trim();
	if (!trimmed) {
		throw new Error("content must not be empty");
	}
	if (trimmed.length > 5000) {
		throw new Error("content is too long");
	}
	return trimmed;
}

export async function sendMessage(rawInput: SendMessageInput): Promise<MessageRecord> {
	assertPositiveInteger(rawInput.senderId, "senderId");
	assertPositiveInteger(rawInput.receiverId, "receiverId");

	if (rawInput.senderId === rawInput.receiverId) {
		throw new Error("senderId and receiverId must be different");
	}

	const users = await prisma.users.findMany({
		where: {
			id: {
				in: [rawInput.senderId, rawInput.receiverId],
			},
		},
		select: {
			id: true,
		},
	});
	if (users.length !== 2) {
		throw new Error("User not found");
	}

	const content = normalizeContent(rawInput.content);

	return prisma.messages.create({
		data: {
			sender_id: rawInput.senderId,
			receiver_id: rawInput.receiverId,
			content,
		},
		select: {
			id: true,
			sender_id: true,
			receiver_id: true,
			content: true,
			created_at: true,
		},
	});
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

export async function listConversation(userAId: number, userBId: number, options: ListConversationOptions = {}) {
	assertPositiveInteger(userAId, "userAId");
	assertPositiveInteger(userBId, "userBId");

	const limit = options.limit ?? 50;
	assertPositiveInteger(limit, "limit");

	return prisma.messages.findMany({
		where: {
			OR: [
				{ sender_id: userAId, receiver_id: userBId },
				{ sender_id: userBId, receiver_id: userAId },
			],
		},
		orderBy: {
			created_at: "asc",
		},
		take: limit,
	});
}

export async function listUserMessages(userId: number, limit = 100) {
	assertPositiveInteger(userId, "userId");
	assertPositiveInteger(limit, "limit");

	return prisma.messages.findMany({
		where: {
			OR: [{ sender_id: userId }, { receiver_id: userId }],
		},
		orderBy: {
			created_at: "desc",
		},
		take: limit,
	});
}

export async function deleteMessage(messageId: number) {
	assertPositiveInteger(messageId, "messageId");

	return prisma.messages.delete({
		where: { id: messageId },
	});
}
