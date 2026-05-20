import express from "express";
import cors from "cors";
import { authenticateToken } from "./middleware/httpAuth";
import type { Request, Response } from "express";

const app = express();
export default app;

app.use(cors()); //#2
app.use(express.json());

export type ApiRequest = Request & { user?: any }; //! consider defining a proper type for user

// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser} = require('./prisma/auth');
const oauthController = require('./auth/oauthController');
// lightweight helpers
const { prisma } = require('./prisma/prisma');
const { getLeaderboard } = require('./prisma/leaderboard');

api.post("/auth/register", async (req: ApiRequest, res: Response) => {
  try {
    const auth = await registerUser(req.body);
    res.status(201).json({ message: "User registered!", ...auth });
  } catch (error) {
    res
      .status(400)
      .json({
        message: "Failed to register user",
        error: error instanceof Error ? error.message : String(error),
      });
  }
});

api.post("/auth/login", async (req: ApiRequest, res: Response) => {
  try {
    const auth = await loginUser(req.body);

    if (!auth) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ message: "User is logged in!", ...auth });
  } catch (error) {
    res
      .status(400)
      .json({
        message: "Failed to log in!",
        error: error instanceof Error ? error.message : String(error),
      });
  }
});

// OAuth routes (GitHub)
api.get('/auth/github', oauthController.redirectToGitHub);
api.get('/auth/github/callback', oauthController.githubCallback);

// OAuth routes (GitHub)
api.get('/auth/github', oauthController.redirectToGitHub);
api.get('/auth/github/callback', oauthController.githubCallback);

api.get("/auth/me", authenticateToken, (req: ApiRequest, res: Response) => {
  res.json({ user: req.user });
});

// to check
// curl http://localhost:3000/api/something
// curl http://localhost:3000/api/users/7

//app.get('/', (req, res) => {
//  res.send('Hello World!');
//});

// GET /api/something  → exact path
//api.get('/something', (req, res) => {
//  res.json({ message: 'handled /api/something' });
//});

// GET /api/users/42  → param "id"
api.get("/users/:id", (req: ApiRequest, res: Response) => {
  res.json({ userId: req.params.id });
});

// GET /api/leaderboards?mode=${mode}&scope=${scope}
api.get('/leaderboards', async (req: ApiRequest, res: Response) => {
  try {
    const mode = (req.query.mode as any) || undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;

    const leaderboard = await getLeaderboard({ mode, limit });

    const result = await Promise.all(
      leaderboard.map(async (entry: any) => {
        const user = await prisma.users.findUnique({ where: { username: entry.nickname }, select: { id: true } });
        return {
          id: user?.id ?? null,
          name: entry.nickname,
          score: entry.score,
          country: null,
        };
      })
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load leaderboard', error: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/users/:username/profile
api.get('/users/:username/profile', async (req: ApiRequest, res: Response) => {
  try {
    const username = req.params.username;
    const user = await prisma.users.findUnique({ where: { username }, select: { id: true, username: true, created_at: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matchPlayers = await prisma.match_players.findMany({
      where: { user_id: user.id },
      include: { matches: { select: { gamemode: true, created_at: true } } },
    });

    const wins = await prisma.match_players.count({ where: { user_id: user.id, result: 'win' } });
    const onlineGames = matchPlayers.length;

    // aggregate per-mode best score and achievedAgo
    const modesMap: Record<string, { value: number | string; achievedAgo?: string } | null> = {};
    const now = new Date();

    for (const mp of matchPlayers) {
      const gm = mp.matches?.gamemode as string | undefined;
      if (!gm) continue;

      // map schema gamemode to public keys
      let key = gm;
      if (gm === 'tetraLeague') key = 'league';
      if (gm === 'customGame') continue; // skip custom

      const score = typeof mp.score === 'number' ? mp.score : 0;
      const existing = modesMap[key];
      if (!existing || (typeof existing.value === 'number' && score > (existing.value as number))) {
        const created = mp.matches?.created_at as Date | null;
        let achievedAgo: string | undefined;
        if (created) {
          const diffMs = now.getTime() - new Date(created).getTime();
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          achievedAgo = days > 0 ? `${days} days ago` : 'recently';
        }

        modesMap[key] = { value: score, achievedAgo };
      }
    }

    // build response matching spec in backend/api.txt
    const response = {
      id: user.id,
      username: user.username,
      country: null,
      avatarId: 0,
      created_at: user.created_at ?? null,
      level: 1,
      xp: 0,
      nextLevelXp: 100,
      playTimeHours: 0,
      onlineGames,
      wins,
      modes: {
        league: modesMap['league'] ?? null,
        quickPlay: modesMap['quickPlay'] ?? null,
        fortyLines: modesMap['fortyLines'] ?? null,
        blitz: modesMap['blitz'] ?? null,
        zen: modesMap['zen'] ?? null,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load profile', error: error instanceof Error ? error.message : String(error) });
  }
});

// POST /api/items  (example)
//api.post('/items', (req, res) => {
//  res.status(201).json({ received: req.body });
//});

app.use("/api", api);

app.get("/health", (req: ApiRequest, res: Response) => {
  res.json({ status: "OK" });
}); //#3

// app.use('/api/auth', authRoutes); //#1
// app.use('/api/user', require('./routes/user.routes')); //!can be normally named as in prev line
// app.use('/api/game', require('./routes/matchmaking.routes'));//! -||-

// all about server info is in 'server.about.txt' in the root of the 'backend' folder.
