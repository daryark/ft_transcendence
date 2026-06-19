import { afterEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("../../prisma/prisma", () => ({
	prisma: {
		users: {
			count: jest.fn(),
		},
		friends: {
			findFirst: jest.fn(),
		},
		messages: {
			count: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
		},
	},
}));

import { prisma } from "../../prisma/prisma";
import {
	listConversation,
	markConversationRead,
	sendMessage,
} from "../../prisma/messages";

const mockedPrisma = prisma as any;

const storedMessage = {
	id: 10,
	sender_id: 1,
	receiver_id: 2,
	content: "hello",
	reply_to_id: null,
	created_at: new Date("2026-06-19T10:00:00.000Z"),
	read_at: null,
};

function allowMessaging() {
	mockedPrisma.users.count.mockResolvedValue(2);
	mockedPrisma.friends.findFirst.mockResolvedValue({ status: "accepted" });
}

describe("messages service", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	test("sends a normalized message between accepted friends", async () => {
		allowMessaging();
		mockedPrisma.messages.create.mockResolvedValue(storedMessage);

		const result = await sendMessage({
			senderId: 1,
			receiverId: 2,
			content: "  hello  ",
		});

		expect(result).toEqual({
			id: 10,
			senderId: 1,
			receiverId: 2,
			content: "hello",
			replyToId: null,
			status: "sent",
			createdAt: "2026-06-19T10:00:00.000Z",
			readAt: null,
		});
		expect(mockedPrisma.messages.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ content: "hello" }),
			}),
		);
	});

	test("rejects messages when the relationship is blocked", async () => {
		mockedPrisma.users.count.mockResolvedValue(2);
		mockedPrisma.friends.findFirst.mockResolvedValue({ status: "blocked" });

		await expect(
			sendMessage({ senderId: 1, receiverId: 2, content: "hello" }),
		).rejects.toThrow("blocked");
		expect(mockedPrisma.messages.create).not.toHaveBeenCalled();
	});

	test("returns the newest page in chronological display order", async () => {
		allowMessaging();
		mockedPrisma.messages.count.mockResolvedValue(3);
		mockedPrisma.messages.findMany.mockResolvedValue([
			{ ...storedMessage, id: 3, content: "third" },
			{ ...storedMessage, id: 2, content: "second" },
			{ ...storedMessage, id: 1, content: "first" },
		]);

		const result = await listConversation(1, 2, { limit: 2 });

		expect(result.items.map((message) => message.id)).toEqual([2, 3]);
		expect(result.nextCursor).toBe(2);
		expect(result.total).toBe(3);
	});

	test("marks only incoming unread messages as read", async () => {
		allowMessaging();
		mockedPrisma.messages.updateMany.mockResolvedValue({ count: 2 });

		const result = await markConversationRead(1, 2);

		expect(result.count).toBe(2);
		expect(mockedPrisma.messages.updateMany).toHaveBeenCalledWith({
			where: { sender_id: 2, receiver_id: 1, read_at: null },
			data: { read_at: expect.any(Date) },
		});
	});
});
