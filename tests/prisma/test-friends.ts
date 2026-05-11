import { prisma } from "../../backend/prisma/prisma";
import {
	acceptFriendRequest,
	createFriendRequest,
	deleteFriendship,
	getFriendshipByPair,
	listFriends,
} from "../../backend/prisma/friends";

/**
 * End-to-end style Prisma script:
 * - seed demo rows
 * - assert expected behavior
 * - cleanup unless KEEP_TEST_DATA=1
 */

type Created = {
	users: { id: number }[];
	friendship: { id: number };
};

async function seedDemoData(): Promise<Created> {
	const suffix = Date.now();

	const userOne = await prisma.users.create({
		data: { email: `friend_u1_${suffix}@example.com`, username: `friend_u1_${suffix}`, password_hash: "x" },
		select: { id: true },
	});
	const userTwo = await prisma.users.create({
		data: { email: `friend_u2_${suffix}@example.com`, username: `friend_u2_${suffix}`, password_hash: "x" },
		select: { id: true },
	});

	const friendship = await createFriendRequest({ userId: userOne.id, friendId: userTwo.id });
	await acceptFriendRequest(friendship.id);

	return {
		users: [userOne, userTwo],
		friendship,
	};
}

async function cleanup(created: Created) {
	await deleteFriendship(created.friendship.id);

	for (const user of created.users) {
		await prisma.users.delete({ where: { id: user.id } });
	}
}

async function main() {
	const created = await seedDemoData();
	console.log("Created friendship:", created.friendship);

	const pair = await getFriendshipByPair(created.users[0].id, created.users[1].id);
	if (!pair || pair.status !== "accepted") {
		throw new Error("Expected accepted friendship");
	}
	console.log("Friendship status:", pair.status);

	const friendsForUser = await listFriends({ userId: created.users[0].id });
	if (friendsForUser.length !== 1) {
		throw new Error("Expected one accepted friendship");
	}
	console.log("Friends count:", friendsForUser.length);

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
		console.error("Friends test failed:", e);
		await prisma.$disconnect();
		process.exit(1);
	});