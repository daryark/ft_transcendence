import bcrypt from "bcrypt";
import { prisma } from "../../../backend/prisma/prisma";

async function main() {
  const suffix = Date.now();
  const email = `test_${suffix}@example.com`;
  const username = `test_user_${suffix}`;
  const password = "secret_test_password";

  const password_hash = await bcrypt.hash(password, 10);

  const created = await prisma.users.create({
    data: {
      email,
      username,
      password_hash,
    },
    select: {
      id: true,
      email: true,
      username: true,
      created_at: true,
    },
  });

  const found = await prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      password_hash: true,
    },
  });

  if (!found) {
    throw new Error("Created user was not found");
  }

  const ok = await bcrypt.compare(password, found.password_hash);
  const wrong = await bcrypt.compare("not_the_password", found.password_hash);

  console.log("Created user id:", created.id);
  console.log("Login simulation (correct password):", ok);
  console.log("Login simulation (wrong password):", wrong);

  if (!ok || wrong) {
    throw new Error("Auth flow checks failed");
  }

  await prisma.users.delete({ where: { id: created.id } });
  console.log("Cleanup complete: test user deleted");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Auth flow test failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
