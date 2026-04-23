import { prisma } from "../../backend/prisma/prisma";

async function main() {
  const userCount = await prisma.users.count();
  console.log("Connection OK. users count:", userCount);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Connection test failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
