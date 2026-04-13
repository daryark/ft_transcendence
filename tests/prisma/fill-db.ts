import bcrypt from "bcrypt";
import { prisma } from "../../backend/prisma/prisma";

const SEED_PREFIX = "manual_seed_";
const DEFAULT_PASSWORD = "SeedPass123!";

async function main() {
  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const seedUsers = [
    { email: `${SEED_PREFIX}alice@seed.local`, username: `${SEED_PREFIX}alice` },
    { email: `${SEED_PREFIX}bob@seed.local`, username: `${SEED_PREFIX}bob` },
    { email: `${SEED_PREFIX}carol@seed.local`, username: `${SEED_PREFIX}carol` },
  ];

  const users = [] as Array<{ id: number; email: string; username: string }>;

  for (const seedUser of seedUsers) {
    const user = await prisma.users.upsert({
      where: { email: seedUser.email },
      update: { username: seedUser.username, password_hash },
      create: { ...seedUser, password_hash },
      select: { id: true, email: true, username: true },
    });

    users.push(user);
  }

  const [alice, bob, carol] = users;

  await prisma.friends.createMany({
    data: [
      { user_id: alice.id, friend_id: bob.id, status: "accepted" },
      { user_id: bob.id, friend_id: alice.id, status: "accepted" },
      { user_id: alice.id, friend_id: carol.id, status: "pending" },
    ],
    skipDuplicates: true,
  });

  const seededMessageCount = await prisma.messages.count({
    where: {
      OR: [
        { sender_id: { in: users.map((u) => u.id) } },
        { receiver_id: { in: users.map((u) => u.id) } },
      ],
    },
  });

  if (seededMessageCount === 0) {
    await prisma.messages.createMany({
      data: [
        { sender_id: alice.id, receiver_id: bob.id, content: "Seed message: Alice -> Bob" },
        { sender_id: bob.id, receiver_id: alice.id, content: "Seed message: Bob -> Alice" },
        { sender_id: carol.id, receiver_id: alice.id, content: "Seed message: Carol -> Alice" },
      ],
    });
  }

  const seededPlayerRows = await prisma.match_players.count({
    where: { user_id: { in: users.map((u) => u.id) } },
  });

  if (seededPlayerRows === 0) {
    const match1 = await prisma.matches.create({ data: { status: "finished" }, select: { id: true } });
    const match2 = await prisma.matches.create({ data: { status: "active" }, select: { id: true } });

    await prisma.match_players.createMany({
      data: [
        { match_id: match1.id, user_id: alice.id, score: 1200, result: "win" },
        { match_id: match1.id, user_id: bob.id, score: 900, result: "lose" },
        { match_id: match2.id, user_id: bob.id, score: 450, result: "draw" },
        { match_id: match2.id, user_id: carol.id, score: 450, result: "draw" },
      ],
    });
  }

  console.log("Seed users ready:", users.map((u) => `${u.username} <${u.email}>`).join(", "));
  console.log(`Default password for seed users: ${DEFAULT_PASSWORD}`);
  console.log("Fill script completed. If you need a fresh state, run prisma:seed:clear and then prisma:seed:fill.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Fill script failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
