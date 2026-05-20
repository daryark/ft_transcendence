import { prisma } from './prisma';
import type { gamemode } from '../generated/prisma/enums';

const prisma = new PrismaClient();

/**
 * Leaderboard entry with user stats
 */
export interface LeaderboardEntry {
  nickname: string;
  victories: number;
  score: number;
}

/**
 * Leaderboard options for filtering and sorting
 */
export interface LeaderboardOptions {
  // Use the generated enum type for stronger typing and to satisfy Prisma's input types
  mode?: gamemode; // Game mode filter (e.g., 'classic', 'blitz', 'rush')
  limit?: number; // Number of top players to return (default: 100)
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
  const { mode, limit = 100 } = options;

  // Query all match players with their user and match info
  const matchPlayers: any[] = await prisma.match_players.findMany({
    where: {
      matches: {
        status: 'finished',
        // Prisma expects either the enum value or an enum filter object;
        // passing the generated enum type `GameMode` satisfies TypeScript.
        ...(mode ? { gamemode: mode } : {}),
      },
    },
    include: {
      users: {
        select: {
          username: true,
        },
      },
      matches: {
        select: {
          gamemode: true,
          status: true,
        },
      },
    },
  });

  // Aggregate stats by user
  const leaderboardMap = new Map<string, LeaderboardEntry>();

  matchPlayers.forEach((matchPlayer: any) => {
    const nickname = matchPlayer.users.username;
    const isVictory = matchPlayer.result === 'win';
    const playerScore = matchPlayer.score || 0;

    if (!leaderboardMap.has(nickname)) {
      leaderboardMap.set(nickname, {
        nickname,
        victories: 0,
        score: 0,
      });
    }

    const entry = leaderboardMap.get(nickname)!;
    if (isVictory) {
      entry.victories += 1;
    }
    entry.score += playerScore;
  });

  // Convert map to array and sort by victories (descending)
  const leaderboard = Array.from(leaderboardMap.values())
    .sort((a, b) => b.victories - a.victories)
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
  mode: gamemode,
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
  mode?: gamemode
): Promise<{
  nickname: string;
  rank: number;
  victories: number;
  score: number;
} | null> {
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user || !user.username) return null;

  const leaderboard = await getLeaderboard({ mode });
  const userEntry = leaderboard.find((entry) => entry.nickname === user.username);
  if (!userEntry) return null;

  const rank = leaderboard.findIndex((entry) => entry.nickname === userEntry.nickname) + 1;
  return {
    nickname: userEntry.nickname,
    rank,
    victories: userEntry.victories,
    score: userEntry.score,
  };
}
