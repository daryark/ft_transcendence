import { prisma } from "../../backend/prisma/prisma";
import { loginUser, registerUser } from "../../backend/prisma/auth";

/**
 * Simple auth test script that mirrors the style of `tests/prisma/test-leaderboard.ts`.
 * - Creates a temporary user
 * - Verifies login success and failure
 * - Cleans up unless KEEP_TEST_USER=1
 */

async function cleanup(userId: number) {
	await prisma.users.delete({ where: { id: userId } });
}

async function main() {
	const suffix = Date.now();
	const email = `auth_demo_${suffix}@example.com`;
	const username = `auth_demo_${suffix}`;
	const password = "demo_password_123";

	const created = await registerUser({ email, username, password });
	console.log("Registered:", created.user);
	console.log("Register token issued:", Boolean(created.token));

	const loggedIn = await loginUser({ email, password });
	console.log("Login with correct password:", Boolean(loggedIn));

	const failedLogin = await loginUser({ email, password: "wrong_password" });
	console.log("Login with wrong password:", Boolean(failedLogin));

	if (process.env.KEEP_TEST_USER !== "1") {
		await cleanup(created.user.id);
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
