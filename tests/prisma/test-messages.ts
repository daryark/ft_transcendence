import { prisma } from "../../backend/prisma/prisma";
import {
	deleteMessage,
	getMessageById,
	listConversation,
	sendMessage,
} from "../../backend/prisma/messages";

/**
 * End-to-end style Prisma script:
 * - seed demo rows
 * - assert expected behavior
 * - cleanup unless KEEP_TEST_DATA=1
 */

type Created = {
	users: { id: number }[];
	messages: { id: number }[];
};

async function seedDemoData(): Promise<Created> {
	const suffix = Date.now();

	const userOne = await prisma.users.create({
		data: { email: `msg_u1_${suffix}@example.com`, username: `msg_u1_${suffix}`, password_hash: "x" },
		select: { id: true },
	});
	const userTwo = await prisma.users.create({
		data: { email: `msg_u2_${suffix}@example.com`, username: `msg_u2_${suffix}`, password_hash: "x" },
		select: { id: true },
	});

	const first = await sendMessage({ senderId: userOne.id, receiverId: userTwo.id, content: "hello there" });
	const second = await sendMessage({ senderId: userTwo.id, receiverId: userOne.id, content: "hi back" });

	return {
		users: [userOne, userTwo],
		messages: [first, second],
	};
}

async function cleanup(created: Created) {
	for (const message of created.messages) {
		await deleteMessage(message.id);
	}

	for (const user of created.users) {
		await prisma.users.delete({ where: { id: user.id } });
	}
}

async function main() {
	const created = await seedDemoData();
	console.log("Created messages:", created.messages.length);

	const message = await getMessageById(created.messages[0].id);
	if (!message) {
		throw new Error("Expected message to exist");
	}
	console.log("Loaded message content:", message.content);

	const conversation = await listConversation(created.users[0].id, created.users[1].id, { limit: 10 });
	if (conversation.length !== 2) {
		throw new Error("Expected two messages in conversation");
	}
	console.log("Conversation count:", conversation.length);

	if (process.env.KEEP_TEST_DATA !== "1") {
		await cleanup(created);
		console.log("Cleanup complete. Set KEEP_TEST_DATA=1 to keep created data.");
	} else {
		console.log("Keeping created test data because KEEP_TEST_DATA=1");
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("Messages test failed:", e);
		await prisma.$disconnect();
		process.exit(1);
	});