import { prisma } from './prisma';
import { z } from 'zod';

export type GameMode =
  | 'quickPlay'
  | 'fortyLines'
  | 'blitz'
  | 'zen'
  | 'customGame';

/**
 * Leaderboard entry with user stats
 */
export interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  country: string;
  achievedAt: Date | null;
}

/**
 * Leaderboard options for filtering and sorting
 */
export interface LeaderboardOptions {
  // mode?: GameMode; // Game mode filter (e.g., 'classic', 'blitz', 'rush')
  // Accept frontend route values and Prisma enum values.
  mode?: string;
  scope?: 'global' | 'country' | 'friends';
  requesterUserId?: number;
  limit?: number;
}

const modeMap: Record<string, string> = {
  quick: 'quickPlay',
  blitz: 'blitz',
  quickPlay: 'quickPlay',
  fortyLines: 'fortyLines',
};

const scopeSchema = z.enum(['global', 'country', 'friends']);

function normalizeMode(mode?: string): GameMode | undefined {
  if (!mode) {
    return undefined;
  }

  return (modeMap[mode] as GameMode | undefined) ?? undefined;
}

async function resolveScopeUserIds(scope: 'global' | 'country' | 'friends', requesterUserId?: number): Promise<number[] | null> {
  if (!requesterUserId || scope === 'global') {
    return null;
  }

  const requester = await prisma.users.findUnique({
    where: { id: requesterUserId } as any,
    select: { country: true } as any,
  }) as any;

  if (scope === 'country') {
    if (!requester?.country) {
      return null;
    }

    const sameCountryUsers = await prisma.users.findMany({
      where: { country: requester.country } as any,
      select: { id: true } as any,
    }) as any;

    return sameCountryUsers.map((user: { id: number }) => user.id);
  }

  const friendships = await prisma.friends.findMany({
    where: {
      status: 'accepted',
      OR: [{ user_id: requesterUserId }, { friend_id: requesterUserId }],
    },
    select: { user_id: true, friend_id: true },
  });

  const ids = new Set<number>([requesterUserId]);
  for (const friendship of friendships) {
    ids.add(friendship.user_id);
    ids.add(friendship.friend_id);
  }

  return Array.from(ids);
}

/**
 * Get leaderboard data sorted by victories
 * Flexible design to support multiple game modes
 * 
 * @param options - LeaderboardOptions for filtering by mode
 * @returns Promise<LeaderboardEntry[]> - Array of leaderboard entries
 * 
 * @example
 * // Get overall leaderboard
 * const leaderboard = await getLeaderboard();
 * 
 * // Get classic mode leaderboard
 * const classicLB = await getLeaderboard({ mode: 'classic', limit: 50 });
 */
export async function getLeaderboard(
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const { mode, scope = 'global', requesterUserId, limit = 100 } = options;
  const resolvedMode = normalizeMode(mode);
  if (mode && !resolvedMode) {
	throw new Error(`Unsupported mode: ${mode}`);
  }

	scopeSchema.parse(scope);

  const allowedUserIds = await resolveScopeUserIds(scope, requesterUserId);

  // Query all match players with their user and match info
  const matchPlayers: any[] = await prisma.match_players.findMany({
    where: {
      matches: {
        status: 'finished',
        // Prisma expects either the enum value or an enum filter object;
        // passing the generated enum type `GameMode` satisfies TypeScript.
        ...(resolvedMode ? { gamemode: resolvedMode } : {}),
      },
      ...(allowedUserIds ? { user_id: { in: allowedUserIds } } : {}),
    },
        include: {
      users: {
        select: {
          id: true,
          username: true,
          country: true,
        } as any,
      },
      matches: {
        select: {
          gamemode: true,
          status: true,
          created_at: true,
        },
      },
    } as any,
  });

  // Keep the best record per user for mode leaderboards. For an unfiltered
  // leaderboard, preserve the historical aggregate behavior.
  const leaderboardMap = new Map<number, LeaderboardEntry & { victories: number }>();

  matchPlayers.forEach((matchPlayer: any) => {
    const userId = matchPlayer.users.id;
    const name = matchPlayer.users.username;
    const country = matchPlayer.users.country ?? "";
    const isVictory = matchPlayer.result === 'win';
    const playerScore = matchPlayer.score || 0;
    const matchDate = matchPlayer.matches.created_at as Date | null;

    if (!leaderboardMap.has(userId)) {
      leaderboardMap.set(userId, {
        id: userId,
        name,
        country,
        victories: 0,
        score: playerScore,
        achievedAt: matchDate,
      });
    } else {
      const entry = leaderboardMap.get(userId)!;

      if (resolvedMode) {
        const isBetterRecord =
          resolvedMode === 'fortyLines'
            ? playerScore < entry.score
            : playerScore > entry.score;

        if (isBetterRecord) {
          entry.score = playerScore;
          entry.achievedAt = matchDate;
        }
      } else {
        entry.score += playerScore;
        if (matchDate && (!entry.achievedAt || matchDate > entry.achievedAt)) {
          entry.achievedAt = matchDate;
        }
      }
    }

    if (isVictory) {
      leaderboardMap.get(userId)!.victories += 1;
    }
  });

  const compareEntries = (
    a: LeaderboardEntry & { victories: number },
    b: LeaderboardEntry & { victories: number },
  ) => {
    if (resolvedMode === 'fortyLines') {
      return a.score - b.score;
    }
    if (resolvedMode) {
      return b.score - a.score;
    }
    return b.victories - a.victories || b.score - a.score;
  };

  const leaderboard = Array.from(leaderboardMap.values())
    .sort(compareEntries)
    .map(({ victories: _victories, ...entry }) => entry)
    .slice(0, limit);

  return leaderboard;
}

/**
 * Get leaderboard for a specific game mode
 * Convenience function - will work once game_mode is added to schema
 * 
 * @param mode - Game mode (e.g., 'classic', 'blitz')
 * @param limit - Number of top players
 * @returns Promise<LeaderboardEntry[]>
 */
export async function getLeaderboardByMode(
  mode: GameMode,
  limit: number = 100
): Promise<LeaderboardEntry[]> {
  return getLeaderboard({ mode, limit });
}

/**
 * Get user rank and stats in the leaderboard
 * 
 * @param userId - User ID
 * @param mode - Optional game mode filter
 * @returns Promise with user rank, victories, and score
 */
export async function getUserLeaderboardStats(
  userId: number,
  mode?: GameMode
): Promise<{
  name: string;
  rank: number;
  score: number;
} | null> {
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user || !user.username) return null;

  const leaderboard = await getLeaderboard({ mode });
  const userEntry = leaderboard.find((entry) => entry.name === user.username);
  if (!userEntry) return null;

  const rank = leaderboard.findIndex((entry) => entry.name === userEntry.name) + 1;
  return {
    name: userEntry.name,
    rank,
    score: userEntry.score,
  };
}
