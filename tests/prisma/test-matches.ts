import { prisma } from "../../backend/prisma/prisma";
import {
	addMatchPlayer,
	createMatch,
	deleteMatch,
	finishMatch,
	listMatchPlayers,
	listMatches,
} from "../../backend/prisma/matches";

/**
 * End-to-end style Prisma script:
 * - seed demo rows
 * - assert expected behavior
 * - cleanup unless KEEP_TEST_DATA=1
 */

type Created = {
	users: { id: number }[];
	match: { id: number };
	players: { id: number }[];
};

async function seedDemoData(): Promise<Created> {
	const suffix = Date.now();

	const userOne = await prisma.users.create({
		data: { email: `match_u1_${suffix}@example.com`, username: `match_u1_${suffix}`, password_hash: "x" },
		select: { id: true },
	});
	const userTwo = await prisma.users.create({
		data: { email: `match_u2_${suffix}@example.com`, username: `match_u2_${suffix}`, password_hash: "x" },
		select: { id: true },
	});

	const match = await createMatch({ gamemode: "classic" });
	const playerOne = await addMatchPlayer({ matchId: match.id, userId: userOne.id, score: 10, result: "win" });
	const playerTwo = await addMatchPlayer({ matchId: match.id, userId: userTwo.id, score: 5, result: "lose" });

	return {
		users: [userOne, userTwo],
		match,
		players: [playerOne, playerTwo],
	};
}

async function cleanup(created: Created) {
	for (const player of created.players) {
		await prisma.match_players.delete({ where: { id: player.id } });
	}

	await deleteMatch(created.match.id);

	for (const user of created.users) {
		await prisma.users.delete({ where: { id: user.id } });
	}
}

async function main() {
	const created = await seedDemoData();
	console.log("Created match:", created.match);

	const loadedMatch = await listMatches({ gamemode: "classic", limit: 10 });
	if (loadedMatch.length === 0) {
		throw new Error("Expected at least one match");
	}
	console.log("Listed matches count:", loadedMatch.length);

	const players = await listMatchPlayers(created.match.id);
	if (players.length !== 2) {
		throw new Error("Expected two match players");
	}
	console.log("Match players count:", players.length);

	const finished = await finishMatch(created.match.id);
	if (finished.status !== "finished") {
		throw new Error("Match was not marked as finished");
	}
	console.log("Match finished:", finished.status);

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
		console.error("Matches test failed:", e);
		await prisma.$disconnect();
		process.exit(1);
	});