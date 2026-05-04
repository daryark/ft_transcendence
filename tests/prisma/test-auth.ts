import bcrypt from "bcrypt";
import { prisma } from "../../backend/prisma/prisma";

/**
 * Simple auth test script that mirrors the style of `tests/prisma/test-leaderboard.ts`.
 * - Creates a temporary user
 * - Verifies login success and failure
 * - Cleans up unless KEEP_TEST_USER=1
 */

type PublicUser = {
	id: number;
	email: string;
	username: string;
	created_at: Date | null;
};

async function registerUser(email: string, username: string, password: string): Promise<PublicUser> {
	const existing = await prisma.users.findFirst({
		where: {
			OR: [{ email }, { username }],
		},
		select: { id: true },
	});

	if (existing) {
		throw new Error("Email or username already exists");
	}

	const password_hash = await bcrypt.hash(password, 10);

	return prisma.users.create({
		data: { email, username, password_hash },
		select: { id: true, email: true, username: true, created_at: true },
	});
}

async function loginUser(email: string, password: string): Promise<PublicUser | null> {
	const user = await prisma.users.findUnique({
		where: { email },
		select: { id: true, email: true, username: true, created_at: true, password_hash: true },
	});

	if (!user) return null;

	const ok = await bcrypt.compare(password, user.password_hash);
	if (!ok) return null;

	return { id: user.id, email: user.email, username: user.username, created_at: user.created_at };
}

async function cleanup(userId: number) {
	await prisma.users.delete({ where: { id: userId } });
}

async function main() {
	const suffix = Date.now();
	const email = `auth_demo_${suffix}@example.com`;
	const username = `auth_demo_${suffix}`;
	const password = "demo_password_123";

	const created = await registerUser(email, username, password);
	console.log("Registered:", created);

	const loggedIn = await loginUser(email, password);
	console.log("Login with correct password:", Boolean(loggedIn));

	const failedLogin = await loginUser(email, "wrong_password");
	console.log("Login with wrong password:", Boolean(failedLogin));

	if (process.env.KEEP_TEST_USER !== "1") {
		await cleanup(created.id);
		console.log("Cleanup complete. Set KEEP_TEST_USER=1 to keep created user.");
	} else {
		console.log("Keeping created test user because KEEP_TEST_USER=1");
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("Auth script failed:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
