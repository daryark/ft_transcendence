import express from "express";
import cors from "cors";
import { authenticateToken } from "./middleware/httpAuth";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./auth/jwt";

const app = express();
export default app;

app.set("trust proxy", true);
app.use(cors()); //#2
app.use(express.json());

export type ApiRequest = Request & { user?: any }; //! consider defining a proper type for user

// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser, changeUserPassword } = require("./prisma/auth");
const { getProfileByUsername, updateMyProfile } = require("./prisma/profile");
const oauthController = require("./auth/oauthController");
// lightweight helpers
const { getLeaderboard } = require("./prisma/leaderboard");

function getAuthenticatedUserId(req: ApiRequest): number | null {
  const authUser = req.user as any;
  const userId = typeof authUser === "object" ? (authUser.sub ?? authUser.id) : authUser;
  const parsedUserId = Number(userId);
  return Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
}

function getOptionalBearerUserId(req: ApiRequest): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), getJwtSecret()) as any;
    const parsedUserId = Number(payload?.sub ?? payload?.id);
    return Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
  } catch {
    return null;
  }
}

api.post("/auth/register", async (req: ApiRequest, res: Response) => {
  try {
    const auth = await registerUser(req.body, req);
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
api.get("/auth/github", oauthController.redirectToGitHub);
api.get("/auth/github/callback", oauthController.githubCallback);

api.get("/auth/me", authenticateToken, (req: ApiRequest, res: Response) => {
  res.json({ user: req.user });
});

// to check
// curl http://localhost:3000/api/something
// curl http://localhost:3000/api/users/7

//app.get("/", (req, res) => {
//  res.send("Hello World!");
//});

// GET /api/something  → exact path
//api.get("/something", (req, res) => {
//  res.json({ message: "handled /api/something" });
//});

// GET /api/users/42  → param "id"
api.get("/users/:id", (req: ApiRequest, res: Response) => {
  res.json({ userId: req.params.id });
});

// GET /api/leaderboards?mode=${mode}&scope=${scope}
api.get("/leaderboards", async (req: ApiRequest, res: Response) => {
  try {
    const mode = typeof req.query.mode === "string" ? req.query.mode : undefined;
    const scope = typeof req.query.scope === "string" ? req.query.scope : "global";
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const requesterUserId = getOptionalBearerUserId(req);

    const leaderboard = await getLeaderboard({ mode, scope: scope as any, requesterUserId: requesterUserId ?? undefined, limit });
    res.json(
      leaderboard.map((entry: any) => ({
        id: entry.id ?? null,
        name: entry.name ?? entry.nickname,
        score: entry.score,
        country: entry.country ?? null,
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isValidationError = message.includes("Unsupported mode") || message.includes("Invalid") || message.includes("Required");
    res.status(isValidationError ? 400 : 500).json({ message: "Failed to load leaderboard", error: message });
  }
});

// GET /api/users/:username/profile
api.get("/users/:username/profile", async (req: ApiRequest, res: Response) => {
  try {
    const profile = await getProfileByUsername(req.params.username);
    res.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "User not found" ? 404 : 400;
    res.status(status).json({ message: "Failed to load profile", error: message });
  }
});

// PATCH /api/users/me/profile
api.patch("/users/me/profile", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const profile = await updateMyProfile(userId, req.body);
    return res.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("required") || message.includes("must") || message.includes("No valid fields") ? 400 : 500;
    return res.status(status).json({ message: "Failed to update profile", error: message });
  }
});

// PATCH /api/users/me/password
api.patch("/users/me/password", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await changeUserPassword(userId, req.body);
    return res.json({ message: "Password updated" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "User not found" ? 404 : 400;
    return res.status(status).json({ message: "Failed to update password", error: message });
  }
});

// -----------------------------------------------------------------------------
// TODO: API route stubs — add real logic later (placeholders return 501)
// These endpoints were noted in `backend/prisma/todo.txt` and should be
// implemented when wiring actual services/DB logic.
// -----------------------------------------------------------------------------

// GET /api/friends
api.get("/friends", (req: ApiRequest, res: Response) => {
  res.status(501).json({ message: "TODO: implement GET /api/friends" });
});

// GET /api/notifications
api.get("/notifications", (req: ApiRequest, res: Response) => {
  res.status(501).json({ message: "TODO: implement GET /api/notifications" });
});

// GET /api/users/search?nickname=...&query=...
api.get("/users/search", (req: ApiRequest, res: Response) => {
  // preserve incoming query params for later implementation
  const { nickname, query } = req.query;
  res.status(501).json({ message: "TODO: implement GET /api/users/search", nickname, query });
});

// GET /api/messages/conversation/:friendId
api.get("/messages/conversation/:friendId", (req: ApiRequest, res: Response) => {
  res.status(501).json({ message: "TODO: implement GET /api/messages/conversation/:friendId", friendId: req.params.friendId });
});

// POST /api/messages
api.post("/messages", (req: ApiRequest, res: Response) => {
  // expected body will be validated/implemented later
  res.status(501).json({ message: "TODO: implement POST /api/messages", received: req.body ?? null });
});

// POST /api/items  (example)
//api.post("/items", (req, res) => {
//  res.status(201).json({ received: req.body });
//});

app.use("/api", api);

app.get("/health", (req: ApiRequest, res: Response) => {
  res.json({ status: "OK" });
}); //#3

// app.use("/api/auth", authRoutes); //#1
// app.use("/api/user", require("./routes/user.routes")); //!can be normally named as in prev line
// app.use("/api/game", require("./routes/matchmaking.routes"));//! -||-

// all about server info is in "server.about.txt" in the root of the "backend" folder.
