import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

type SeededUser = {
	id: number;
	email: string;
	username: string;
};

const gamemodes = ["quickPlay", "tetraLeague", "fortyLines", "blitz", "zen"] as const;
const friendStatuses = ["accepted", "pending", "blocked"] as const;

async function createUsers(seedId: string, passwordHash: string): Promise<SeededUser[]> {
	const countries = ["France", "Brazil", "Japan", "Canada", "Germany", "Spain", "Chile", "Italy", "Morocco", "Poland"];
	const userSeeds = Array.from({ length: 10 }, (_, index) => {
		const number = index + 1;

		return {
			email: `seed_${seedId}_user_${number}@example.com`,
			username: `seed_${seedId}_user_${number}`,
			country: countries[index],
			level: number,
			xp: number * 150,
			next_level_xp: number * 200,
			play_time_seconds: number * 900,
			wins: number - 1,
			avatar_id: index,
			password_hash: passwordHash,
		};
	});

	return Promise.all(
		userSeeds.map((user) =>
			prisma.users.create({
				data: user,
				select: { id: true, email: true, username: true },
			}),
		),
	);
}

async function createFriendships(users: SeededUser[]) {
	return Promise.all(
		users.map((user, index) => {
			const friend = users[(index + 1) % users.length];

			return prisma.friends.create({
				data: {
					user_id: user.id,
					friend_id: friend.id,
					status: friendStatuses[index % friendStatuses.length],
				},
				select: { id: true },
			});
		}),
	);
}

async function createMessages(users: SeededUser[]) {
	return Promise.all(
		Array.from({ length: 12 }, (_, index) => {
			const sender = users[index % users.length];
			const receiver = users[(index + 3) % users.length];

			return prisma.messages.create({
				data: {
					sender_id: sender.id,
					receiver_id: receiver.id,
					content: `Seed message ${index + 1} from ${sender.username} to ${receiver.username}`,
				},
				select: { id: true },
			});
		}),
	);
}

async function createOauthAccounts(users: SeededUser[], seedId: string) {
	return Promise.all(
		users.map((user, index) =>
			prisma.oauth_accounts.create({
				data: {
					user_id: user.id,
					provider: index % 2 === 0 ? "42" : "github",
					provider_user_id: `${seedId}_${index + 1}`,
					provider_data: {
						seedId,
						username: user.username,
					},
				},
				select: { id: true },
			}),
		),
	);
}

async function createMatches(users: SeededUser[]) {
	const matches = await Promise.all(
		Array.from({ length: 5 }, (_, index) =>
			prisma.matches.create({
				data: {
					status: "finished",
					gamemode: gamemodes[index % gamemodes.length],
				},
				select: { id: true },
			}),
		),
	);

	const matchPlayerCreates = [] as Array<Promise<{ id: number }>>;

	for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
		const match = matches[matchIndex];
		const firstUser = users[(matchIndex * 2) % users.length];
		const secondUser = users[(matchIndex * 2 + 1) % users.length];
		const secondResult: "lose" | "draw" = matchIndex === 2 ? "draw" : "lose";

		matchPlayerCreates.push(
			prisma.match_players.create({
				data: {
					match_id: match.id,
					user_id: firstUser.id,
					score: 10 + matchIndex * 2,
					result: "win",
				},
				select: { id: true },
			}),
		);

		matchPlayerCreates.push(
			prisma.match_players.create({
				data: {
					match_id: match.id,
					user_id: secondUser.id,
					score: 4 + matchIndex,
					result: secondResult,
				},
				select: { id: true },
			}),
		);
	}

	const matchPlayers = await Promise.all(matchPlayerCreates);

	return { matches, matchPlayers };
}

async function main() {
	const seedId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
	const passwordHash = await bcrypt.hash("Password123!", 10);

	console.log(`Seeding database with batch ${seedId}...`);

	const users = await createUsers(seedId, passwordHash);
	const friendships = await createFriendships(users);
	const messages = await createMessages(users);
	const oauthAccounts = await createOauthAccounts(users, seedId);
	const matches = await createMatches(users);

	console.log(`Created ${users.length} users`);
	console.log(`Created ${friendships.length} friendships`);
	console.log(`Created ${messages.length} messages`);
	console.log(`Created ${oauthAccounts.length} oauth accounts`);
	console.log(`Created ${matches.matches.length} matches and ${matches.matchPlayers.length} match players`);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error("Seed script failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});