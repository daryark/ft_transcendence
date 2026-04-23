import { prisma } from "../../backend/prisma/prisma";

const SEED_PREFIX = "manual_seed_";

async function main() {
  const seedUsers = await prisma.users.findMany({
    where: { email: { startsWith: SEED_PREFIX } },
    select: { id: true, email: true, username: true },
  });

  if (seedUsers.length === 0) {
    console.log("No seeded users found. Nothing to clear.");
    return;
  }

  const userIds = seedUsers.map((u) => u.id);

  const seededMatchPlayers = await prisma.match_players.findMany({
    where: { user_id: { in: userIds } },
    select: { match_id: true },
  });

  const matchIds = [...new Set(seededMatchPlayers.map((p) => p.match_id))];

  await prisma.friends.deleteMany({
    where: {
      OR: [{ user_id: { in: userIds } }, { friend_id: { in: userIds } }],
    },
  });

  await prisma.messages.deleteMany({
    where: {
      OR: [{ sender_id: { in: userIds } }, { receiver_id: { in: userIds } }],
    },
  });

  await prisma.match_players.deleteMany({
    where: { user_id: { in: userIds } },
  });

  await prisma.users.deleteMany({
    where: { id: { in: userIds } },
  });

  if (matchIds.length > 0) {
    await prisma.matches.deleteMany({
      where: {
        id: { in: matchIds },
        match_players: { none: {} },
      },
    });
  }

  console.log("Cleared seeded users:", seedUsers.map((u) => u.email).join(", "));
  console.log("Clear script completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Clear script failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
