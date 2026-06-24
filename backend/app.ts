import express from "express";
import cors from "cors";
import { authenticateToken } from "./middleware/httpAuth";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./auth/jwt";
import { emitMessageUpdate, emitSocialUpdate } from "./sockets/realtime";
import { notifyUser } from "./notifications/service";
import { isUserOnline } from "./sockets/presence";

const app = express();
export default app;

app.set("trust proxy", true);
app.use(cors()); //#2
app.use(express.json());

export type ApiRequest = Request & { user?: any }; //! consider defining a proper type for user

// All routes here are under /api/... (matches nginx proxy_pass to this app)
const api = express.Router();
const { registerUser, loginUser, changeUserPassword } = require("./prisma/auth");
const { getProfileByUsername, updateMyProfile, getMiniProfileByUsername } = require("./prisma/profile");
const { searchUsers } = require("./prisma/search");
const { listFriends, createFriendRequest, acceptFriendRequestById, rejectFriendRequestById, removeFriendshipByPair, blockFriendshipByPair, } = require("./prisma/friends");
const { listNotifications, markNotificationRead, markAllNotificationsRead } = require("./prisma/notifications");
const { listConversation, markConversationRead, markMessageRead, sendMessage } = require("./prisma/messages");
const oauthController = require("./auth/oauthController");
// lightweight helpers
const { getLeaderboard } = require("./prisma/leaderboard");
const { getUserAchievements } = require("./prisma/achievements");

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

function getAuthenticatedUsername(req: ApiRequest): string | null {
  const authUser = req.user as any;
  const username = typeof authUser === "object" ? authUser?.username : null;
  return typeof username === "string" && username.trim().length > 0 ? username.trim() : null;
}

function sendOk(res: Response, data: any, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function sendError(res: Response, status: number, error: string) {
  return res.status(status).json({ ok: false, error });
}

function parsePaginationQuery(req: ApiRequest) {
  const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

  if (!Number.isInteger(page) || page <= 0) {
    throw new Error("page must be a positive integer");
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer");
  }

  if (limit > 50) {
    throw new Error("limit must be 50 or less");
  }

  return { page, limit };
}

function parseFriendStatusFilter(req: ApiRequest) {
  const rawStatus = typeof req.query.status === "string" ? req.query.status : "all";

  if (rawStatus !== "all" && rawStatus !== "pending" && rawStatus !== "accepted" && rawStatus !== "blocked") {
    throw new Error("status must be all, pending, accepted, or blocked");
  }

  return rawStatus;
}

function getFriendActionTargetId(body: any) {
  const targetId = Number(body?.targetUserId ?? body?.userId);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error("targetUserId must be a positive integer");
  }

  return targetId;
}

const messageRateLimits = new Map<number, number[]>();

function enforceMessageRateLimit(userId: number) {
  const now = Date.now();
  const windowStart = now - 10_000;
  const recent = (messageRateLimits.get(userId) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= 20) {
    throw new Error("Too many messages. Please wait a moment.");
  }

  recent.push(now);
  messageRateLimits.set(userId, recent);
}

function getMessageTargetId(body: any) {
  const targetId = Number(body?.toUserId ?? body?.receiverId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error("toUserId must be a positive integer");
  }
  return targetId;
}

function getMessageErrorStatus(message: string) {
  if (message === "User not found" || message === "Message not found") return 404;
  if (
    message.includes("not friends") ||
    message.includes("blocked") ||
    message.includes("must be accepted")
  ) return 403;
  if (message.startsWith("Too many messages")) return 429;
  return 400;
}

function getMessageNotificationPreview(content: string) {
  const singleLine = content.replace(/\s+/g, " ").trim();
  return singleLine.length > 120 ? `${singleLine.slice(0, 117)}...` : singleLine;
}

api.post("/auth/register", async (req: ApiRequest, res: Response) => {
  try {
    const auth = await registerUser(req.body, req);
    res.status(201).json({ message: "User registered!", ...auth });
  } catch (error) {
    res
      // .status(400)
      .json({
        message: "Failed to register user",
        error: error instanceof Error ? error.message : String(error),
      });
  }
});

api.post("/auth/login", async (req: ApiRequest, res: Response) => {
  try {
    const auth = await loginUser(req.body);
    res.status(200).json({ message: "User is logged in!", ...auth });
  } catch (error) {
    res
      // .status(401)
      .json({
        message: "Failed to log in!",
        error: error instanceof Error ? error.message : String(error),
      });
  }
});

api.get("/auth/country", async (req: ApiRequest, res: Response) => {
  try {
    const { resolveCountryFromRequest } = await import("./prisma/ip.js");
    const country = await resolveCountryFromRequest(req);
    res.json({ country: country || null });
  } catch (error) {
    res.json({ country: null });
  }
});

// OAuth routes (GitHub)
api.get("/auth/github", oauthController.redirectToGitHub);
api.get("/auth/github/callback", oauthController.githubCallback);
api.post("/auth/github/exchange", oauthController.exchangeOAuthCode);

api.get("/auth/me", authenticateToken, (req: ApiRequest, res: Response) => {
  res.json({ user: req.user });
});

api.get("/achievements", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const achievements = await getUserAchievements(userId);
    return res.json({ achievements });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      message: "Failed to load achievements",
      error: message,
    });
  }
});

// GET /api/users/search?nickname=...&query=...
api.get("/users/search", async (req: ApiRequest, res: Response) => {
  try {
    const term = typeof req.query.q === "string" && req.query.q.trim().length > 0
      ? req.query.q
      : typeof req.query.nickname === "string" && req.query.nickname.trim().length > 0
        ? req.query.nickname
        : typeof req.query.query === "string" && req.query.query.trim().length > 0
          ? req.query.query
          : "";
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const requesterUserId = getOptionalBearerUserId(req);

    const results = await searchUsers({
      term,
      page,
      limit,
      requesterUserId: requesterUserId ?? undefined,
    });

    res.json({
      ...results,
      items: results.items.map((entry: any) => ({
        ...entry,
        status: isUserOnline(entry.id) ? "online" : entry.status,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("required") || message.includes("must") || message.includes("range") ? 400 : 500;
    res.status(status).json({ message: "Failed to search users", error: message });
  }
});

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
        country: entry.country ?? "",
        achievedAt:
          entry.achievedAt instanceof Date
            ? entry.achievedAt.toISOString()
            : null,
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

// GET /api/users/:username/miniprofile
api.get("/users/:username/miniprofile", async (req: ApiRequest, res: Response) => {
  try {
    const mini = await getMiniProfileByUsername(req.params.username);
    res.json(mini);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "User not found" ? 404 : 400;
    res.status(status).json({ message: "Failed to load miniprofile", error: message });
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

// GET /api/friends
api.get("/friends", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);

    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { page, limit } = parsePaginationQuery(req);
    const status = parseFriendStatusFilter(req);

    const result = await listFriends({ userId: requesterUserId, status, page, limit });
    const items = result.items.map((friendship: any) => {
      const isRequester = friendship.user_id === requesterUserId;
      const otherUser = isRequester
        ? friendship.users_friends_friend_idTousers
        : friendship.users_friends_user_idTousers;

      return {
        id: friendship.id,
        userId: friendship.user_id,
        friendId: friendship.friend_id,
        status: friendship.status,
        createdAt: friendship.created_at ? friendship.created_at.toISOString() : null,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          avatarId: otherUser.avatar_id ?? 0,
          online: isUserOnline(otherUser.id),
        },
      };
    });

    return sendOk(res, { items, page: result.page, limit: result.limit, total: result.total });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, message.includes("Unauthorized") ? 401 : 400, message);
  }
});

// POST /api/friends/request
api.post("/friends/request", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }
    const requesterUsername = getAuthenticatedUsername(req) ?? "Someone";

    const friendId = getFriendActionTargetId(req.body);
    const friendship = await createFriendRequest({ userId: requesterUserId, friendId });
    emitSocialUpdate([requesterUserId, friendId], {
      action: friendship.status === "accepted" ? "accepted" : "requested",
      userIds: [requesterUserId, friendId],
    });

    if (friendship.status === "pending") {
      await notifyUser(friendId, {
        actorId: requesterUserId,
        type: "friend_request",
        title: "Friend request",
        body: `${requesterUsername} sent you a friend request.`,
        link: "/play",
        payload: { friendshipId: friendship.id, requesterUserId },
      });
    }

    return sendOk(res, {
      friendship: {
        id: friendship.id,
        userId: friendship.user_id,
        friendId: friendship.friend_id,
        status: friendship.status,
        createdAt: friendship.created_at ? friendship.created_at.toISOString() : null,
      },
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not be different") || message.includes("positive integer") ? 400 : 409;
    return sendError(res, status, message);
  }
});

// POST /api/friends/respond
api.post("/friends/respond", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }
    const requesterUsername = getAuthenticatedUsername(req) ?? "Someone";

    const friendshipId = Number(req.body?.requestId);
    const action = typeof req.body?.action === "string" ? req.body.action : "";

    if (!Number.isInteger(friendshipId) || friendshipId <= 0) {
      throw new Error("requestId must be a positive integer");
    }

    if (action !== "accept" && action !== "reject") {
      throw new Error("action must be accept or reject");
    }

    const friendship = action === "accept"
      ? await acceptFriendRequestById(friendshipId, requesterUserId)
      : await rejectFriendRequestById(friendshipId, requesterUserId);
    emitSocialUpdate([friendship.user_id, friendship.friend_id], {
      action: action === "accept" ? "accepted" : "rejected",
      userIds: [friendship.user_id, friendship.friend_id],
    });

    await notifyUser(friendship.user_id, {
      actorId: requesterUserId,
      type: action === "accept" ? "friend_request_accepted" : "friend_request_rejected",
      title: action === "accept" ? "Friend request accepted" : "Friend request rejected",
      body:
        action === "accept"
          ? `${requesterUsername} accepted your friend request.`
          : `${requesterUsername} rejected your friend request.`,
      link: "/play",
      payload: { friendshipId: friendship.id, action },
    });

    return sendOk(res, {
      friendship: {
        id: friendship.id,
        userId: friendship.user_id,
        friendId: friendship.friend_id,
        status: friendship.status ?? (action === "reject" ? null : friendship.status),
        createdAt: friendship.created_at ? friendship.created_at.toISOString() : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 404 : message.includes("allowed") ? 403 : 400;
    return sendError(res, status, message);
  }
});

// POST /api/friends/remove
api.post("/friends/remove", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const targetUserId = getFriendActionTargetId(req.body);
    await removeFriendshipByPair(requesterUserId, targetUserId);
    emitSocialUpdate([requesterUserId, targetUserId], {
      action: "removed",
      userIds: [requesterUserId, targetUserId],
    });

    return sendOk(res, { removed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 404 : message.includes("allowed") ? 403 : 400;
    return sendError(res, status, message);
  }
});

// POST /api/friends/block
api.post("/friends/block", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const targetUserId = getFriendActionTargetId(req.body);
    const friendship = await blockFriendshipByPair(requesterUserId, targetUserId);
    emitSocialUpdate([requesterUserId, targetUserId], {
      action: "blocked",
      userIds: [requesterUserId, targetUserId],
    });

    return sendOk(res, {
      friendship: {
        id: friendship.id,
        userId: friendship.user_id,
        friendId: friendship.friend_id,
        status: friendship.status,
        createdAt: friendship.created_at ? friendship.created_at.toISOString() : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("different") ? 400 : 500;
    return sendError(res, status, message);
  }
});

// GET /api/notifications
api.get("/notifications", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const { page, limit } = parsePaginationQuery(req);
    const result = await listNotifications({ userId: requesterUserId, page, limit });

    return sendOk(res, {
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, message.includes("Unauthorized") ? 401 : 400, message);
  }
});

// PATCH /api/notifications/:id/read
api.patch("/notifications/read", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const result = await markAllNotificationsRead(requesterUserId);
    return sendOk(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, message.includes("Unauthorized") ? 401 : 400, message);
  }
});

api.patch("/notifications/:id/read", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const notificationId = Number(req.params.id);
    const notification = await markNotificationRead(notificationId, requesterUserId);
    return sendOk(res, { notification });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Notification not found" ? 404 : message.includes("Unauthorized") ? 401 : 400;
    return sendError(res, status, message);
  }
});

// GET /api/messages/conversation/:friendId
api.get("/messages/conversation/:friendId", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const friendId = Number(req.params.friendId);
    if (!Number.isInteger(friendId) || friendId <= 0) {
      throw new Error("friendId must be a positive integer");
    }

    const { page, limit } = parsePaginationQuery(req);
    const cursor = req.query.cursor === undefined ? undefined : Number(req.query.cursor);
    if (cursor !== undefined && (!Number.isInteger(cursor) || cursor <= 0)) {
      throw new Error("cursor must be a positive integer");
    }

    const conversation = await listConversation(requesterUserId, friendId, {
      page,
      limit,
      cursor,
    });
    return sendOk(res, conversation);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, getMessageErrorStatus(message), message);
  }
});

// POST /api/messages
api.post("/messages", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    enforceMessageRateLimit(requesterUserId);
    const receiverId = getMessageTargetId(req.body);
    const replyTo = req.body?.replyTo === undefined ? undefined : Number(req.body.replyTo);
    const message = await sendMessage({
      senderId: requesterUserId,
      receiverId,
      content: req.body?.body ?? req.body?.content,
      replyToId: replyTo,
    });
    const senderUsername = getAuthenticatedUsername(req) ?? "Someone";

    emitMessageUpdate([requesterUserId, receiverId], {
      action: "created",
      message,
    });

    await notifyUser(receiverId, {
      actorId: requesterUserId,
      type: "new_message",
      title: `New message from ${senderUsername}`,
      body: getMessageNotificationPreview(message.content),
      link: "/play",
      payload: {
        messageId: message.id,
        senderId: requesterUserId,
        conversationUserId: requesterUserId,
      },
    });

    return sendOk(res, { message }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, getMessageErrorStatus(message), message);
  }
});

// PATCH /api/messages/:id/read
api.patch("/messages/:id/read", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const messageId = Number(req.params.id);
    const message = await markMessageRead(messageId, requesterUserId);
    emitMessageUpdate([message.senderId, message.receiverId], {
      action: "read",
      message,
    });
    return sendOk(res, { message });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, getMessageErrorStatus(message), message);
  }
});

// PATCH /api/messages/conversation/:friendId/read
api.patch("/messages/conversation/:friendId/read", authenticateToken, async (req: ApiRequest, res: Response) => {
  try {
    const requesterUserId = getAuthenticatedUserId(req);
    if (!requesterUserId) {
      return sendError(res, 401, "Unauthorized");
    }

    const friendId = Number(req.params.friendId);
    const result = await markConversationRead(requesterUserId, friendId);
    if (result.count > 0) {
      emitMessageUpdate([requesterUserId, friendId], {
        action: "conversation-read",
        readerId: requesterUserId,
        friendId,
        ...result,
      });
    }
    return sendOk(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendError(res, getMessageErrorStatus(message), message);
  }
});

app.use("/api", api);

app.get("/health", (req: ApiRequest, res: Response) => {
  res.json({ status: "OK" });
}); //#3

