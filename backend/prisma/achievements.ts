import type { Prisma } from "@prisma/client";
import { ACHIEVEMENTS, type AchievementCode } from "./achievementCatalog";
import { prisma } from "./prisma";

export type AchievementGameStats = {
  lines: number;
  piecesPlaced: number;
  hardDrops: number;
  holds: number;
  maxCombo: number;
  maxLinesCleared: number;
  clearedTwoAtOnce: boolean;
  clearedThreeAtOnce: boolean;
  tetrises: number;
  durationMs: number;
  clearedAfterHalfHeight: boolean;
};

type AwardContext = AchievementGameStats & {
  score: number;
  totalLines: number;
  level: number;
  multiplayer: boolean;
};

const clean = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

type UserAchievementUnlock = {
  achievement_id: number;
  unlocked_at: Date;
};

async function ensureAchievementCatalog(
  client: Pick<Prisma.TransactionClient, "achievements">,
) {
  await client.achievements.createMany({
    data: ACHIEVEMENTS.map((achievement) => ({
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      rarity: achievement.rarity,
      target: achievement.target,
    })),
    skipDuplicates: true,
  });
}

function getProgress(code: AchievementCode, value: AwardContext) {
  switch (code) {
    case "first_piece": return value.piecesPlaced;
    case "first_line": return value.lines;
    case "double_clear": return value.clearedTwoAtOnce ? 2 : 0;
    case "triple_clear": return value.clearedThreeAtOnce ? 3 : 0;
    case "pieces_25":
    case "pieces_100":
    case "pieces_500": return value.piecesPlaced;
    case "hard_drops_25":
    case "hard_drops_100":
    case "hard_drops_250": return value.hardDrops;
    case "first_hold":
    case "holds_25":
    case "holds_100": return value.holds;
    case "tiny_comeback": return value.clearedAfterHalfHeight ? 1 : 0;
    case "total_lines_10": return value.totalLines;
    case "score_1000":
    case "score_10000": return value.score;
    case "first_tetris":
    case "tetrises_10": return value.tetrises;
    case "lines_25":
    case "lines_100": return value.lines;
    case "combo_3":
    case "combo_5": return value.maxCombo;
    case "multiplayer_survive_180":
    case "multiplayer_survive_300":
      return value.multiplayer ? Math.floor(value.durationMs / 1000) : 0;
    case "level_10":
    case "level_50": return value.level;
    case "multiplayer_score_50000": return value.multiplayer ? value.score : 0;
  }
}

export async function awardAchievements(
  tx: Prisma.TransactionClient,
  userId: number,
  input: AchievementGameStats & { score: number; multiplayer: boolean },
) {
  await ensureAchievementCatalog(tx);

  const [lineAggregate, user] = await Promise.all([
    tx.match_players.aggregate({
      where: { user_id: userId },
      _sum: { lines: true },
    }),
    tx.users.findUnique({
      where: { id: userId },
      select: { level: true },
    }),
  ]);

  const context: AwardContext = {
    score: clean(input.score),
    lines: clean(input.lines),
    piecesPlaced: clean(input.piecesPlaced),
    hardDrops: clean(input.hardDrops),
    holds: clean(input.holds),
    maxCombo: clean(input.maxCombo),
    maxLinesCleared: clean(input.maxLinesCleared),
    clearedTwoAtOnce: input.clearedTwoAtOnce,
    clearedThreeAtOnce: input.clearedThreeAtOnce,
    tetrises: clean(input.tetrises),
    durationMs: clean(input.durationMs),
    clearedAfterHalfHeight: input.clearedAfterHalfHeight,
    totalLines: clean(lineAggregate._sum.lines ?? 0),
    level: clean(user?.level ?? 1),
    multiplayer: input.multiplayer,
  };

  const unlocked = ACHIEVEMENTS.filter(
    (achievement) => getProgress(achievement.code, context) >= achievement.target,
  );
  const existingUnlocks = unlocked.length > 0
    ? await tx.user_achievements.findMany({
        where: {
          user_id: userId,
          achievement_id: { in: unlocked.map((achievement) => achievement.id) },
        },
        select: { achievement_id: true },
      })
    : [];
  const existingIds = new Set(
    existingUnlocks.map((unlock: { achievement_id: number }) => unlock.achievement_id),
  );
  const newlyUnlocked = unlocked.filter(
    (achievement) => !existingIds.has(achievement.id),
  );

  if (newlyUnlocked.length > 0) {
    await tx.user_achievements.createMany({
      data: newlyUnlocked.map((achievement) => ({
        user_id: userId,
        achievement_id: achievement.id,
      })),
      skipDuplicates: true,
    });
  }

  return newlyUnlocked;
}

export async function getUserAchievements(userId: number) {
  await ensureAchievementCatalog(prisma);

  const [
    unlocks,
    user,
    aggregates,
    multiplayerAggregates,
    comebackCount,
    doubleClearCount,
    tripleClearCount,
  ] = await Promise.all([
    prisma.user_achievements.findMany({
      where: { user_id: userId },
      select: { achievement_id: true, unlocked_at: true },
    }),
    prisma.users.findUnique({
      where: { id: userId },
      select: { level: true },
    }),
    prisma.match_players.aggregate({
      where: { user_id: userId },
      _sum: { lines: true },
      _max: {
        score: true,
        lines: true,
        pieces_placed: true,
        hard_drops: true,
        holds: true,
        max_combo: true,
        max_lines_cleared: true,
        tetrises: true,
        duration_ms: true,
      },
    }),
    prisma.match_players.aggregate({
      where: {
        user_id: userId,
        matches: { gamemode: { in: ["quickPlay", "tetraLeague", "customGame"] } },
      },
      _max: { score: true, duration_ms: true },
    }),
    prisma.match_players.count({
      where: { user_id: userId, cleared_after_half_height: true },
    }),
    prisma.match_players.count({
      where: { user_id: userId, cleared_two_at_once: true },
    }),
    prisma.match_players.count({
      where: { user_id: userId, cleared_three_at_once: true },
    }),
  ]);

  if (!user) throw new Error("User not found");

  const unlockedById = new Map(
    (unlocks as UserAchievementUnlock[]).map((unlock) => [
      unlock.achievement_id,
      unlock.unlocked_at,
    ]),
  );
  const best: AwardContext = {
    score: clean(aggregates._max.score ?? 0),
    lines: clean(aggregates._max.lines ?? 0),
    piecesPlaced: clean(aggregates._max.pieces_placed ?? 0),
    hardDrops: clean(aggregates._max.hard_drops ?? 0),
    holds: clean(aggregates._max.holds ?? 0),
    maxCombo: clean(aggregates._max.max_combo ?? 0),
    maxLinesCleared: clean(aggregates._max.max_lines_cleared ?? 0),
    clearedTwoAtOnce: doubleClearCount > 0,
    clearedThreeAtOnce: tripleClearCount > 0,
    tetrises: clean(aggregates._max.tetrises ?? 0),
    durationMs: clean(multiplayerAggregates._max.duration_ms ?? 0),
    clearedAfterHalfHeight: comebackCount > 0,
    totalLines: clean(aggregates._sum.lines ?? 0),
    level: clean(user.level ?? 1),
    multiplayer: true,
  };

  return ACHIEVEMENTS.map((achievement) => {
    const unlockedAt = unlockedById.get(achievement.id) ?? null;
    const progress = unlockedAt
      ? achievement.target
      : getProgress(achievement.code, {
            ...best,
            score:
              achievement.code === "multiplayer_score_50000"
                ? clean(multiplayerAggregates._max.score ?? 0)
                : best.score,
          });

    return {
      ...achievement,
      progress: Math.min(achievement.target, progress),
      unlocked: Boolean(unlockedAt),
      unlockedAt: unlockedAt?.toISOString() ?? null,
    };
  });
}
