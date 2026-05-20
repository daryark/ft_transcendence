import { prisma } from "../../backend/prisma/prisma";
import { getLeaderboard, getLeaderboardByMode } from "../../backend/prisma/leaderboard";

type Created = {
  users: { id: number }[];
  matches: { id: number }[];
  matchPlayers: { id: number }[];
};

async function seedDemoData(): Promise<Created> {
  const suffix = Date.now();

  // create demo users
  const u1 = await prisma.users.create({ data: { email: `lb_u1_${suffix}@example.com`, username: `lb_u1_${suffix}`, password_hash: "x" }, select: { id: true } });
  const u2 = await prisma.users.create({ data: { email: `lb_u2_${suffix}@example.com`, username: `lb_u2_${suffix}`, password_hash: "x" }, select: { id: true } });
  const u3 = await prisma.users.create({ data: { email: `lb_u3_${suffix}@example.com`, username: `lb_u3_${suffix}`, password_hash: "x" }, select: { id: true } });

  // create two finished matches in different modes
  const mClassic = await prisma.matches.create({ data: { status: 'finished', gamemode: 'classic' }, select: { id: true } });
  const mBlitz = await prisma.matches.create({ data: { status: 'finished', gamemode: 'blitz' }, select: { id: true } });

  // classic match: u1 wins, u2 loses
  const mp1 = await prisma.match_players.create({ data: { match_id: mClassic.id, user_id: u1.id, result: 'win', score: 10 }, select: { id: true } });
  const mp2 = await prisma.match_players.create({ data: { match_id: mClassic.id, user_id: u2.id, result: 'lose', score: 5 }, select: { id: true } });

  // blitz match: u3 wins, u1 loses
  const mp3 = await prisma.match_players.create({ data: { match_id: mBlitz.id, user_id: u3.id, result: 'win', score: 8 }, select: { id: true } });
  const mp4 = await prisma.match_players.create({ data: { match_id: mBlitz.id, user_id: u1.id, result: 'lose', score: 3 }, select: { id: true } });

  return {
    users: [u1, u2, u3],
    matches: [mClassic, mBlitz],
    matchPlayers: [mp1, mp2, mp3, mp4],
  };
}

async function cleanup(created: Created) {
  // delete match_players first
  for (const mp of created.matchPlayers) {
    await prisma.match_players.delete({ where: { id: mp.id } });
  }
  // delete matches
  for (const m of created.matches) {
    await prisma.matches.delete({ where: { id: m.id } });
  }
  // delete users
  for (const u of created.users) {
    await prisma.users.delete({ where: { id: u.id } });
  }
}

async function main() {
  console.log("Seeding demo leaderboard data...");
  const created = await seedDemoData();
  console.log("Seed complete. Running leaderboard queries...");

  const overall = await getLeaderboard();
  console.log("Overall leaderboard:", overall);

  const classic = await getLeaderboardByMode('classic');
  console.log("Classic leaderboard:", classic);

  const blitz = await getLeaderboardByMode('blitz');
  console.log("Blitz leaderboard:", blitz);

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
    console.error("Leaderboard test script failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
