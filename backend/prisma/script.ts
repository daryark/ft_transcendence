import { config as loadEnv } from "dotenv";
import { expand } from "dotenv-expand";
import { PrismaClient } from "../generated/prisma/client";

expand(loadEnv());

const prisma = new PrismaClient();

async function main() {
  // Use your actual schema model name: `users`.
  const allUsers = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      created_at: true,
    },
  });

  console.log("Users:", JSON.stringify(allUsers, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });