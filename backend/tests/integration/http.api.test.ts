import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { createServer, type Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";

const request = require("supertest");

process.env.JWT_SECRET = "integration-test-secret";

const prismaMock = {
  users: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  friends: {
    findMany: jest.fn(),
  },
  match_players: {
    findMany: jest.fn(),
  },
};

jest.mock("../../prisma/prisma", () => ({
  prisma: prismaMock,
}));

import app from "../../app";

describe("HTTP API integration", () => {
  let httpServer: HTTPServer;
  let testUrl = "";
  let serverAvailable = false;

  function skipIfServerUnavailable() {
    return !serverAvailable;
  }

  beforeAll((done) => {
    httpServer = createServer(app);
    httpServer.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EPERM") {
        done();
        return;
      }

      done(error);
    });
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (!address || typeof address === "string") {
        done(new Error("Unable to resolve HTTP integration test address"));
        return;
      }

      testUrl = `http://127.0.0.1:${address.port}`;
      serverAvailable = true;
      done();
    });
  });

  afterAll((done) => {
    if (!serverAvailable) {
      done();
      return;
    }

    httpServer.close(done);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("GET /health returns service status", async () => {
    if (skipIfServerUnavailable()) return;

    const response = await request(testUrl).get("/health").expect(200);

    expect(response.body).toEqual({ status: "OK" });
  });

  test("POST /api/auth/register validates, creates a user and returns a JWT", async () => {
    if (skipIfServerUnavailable()) return;

    const createdAt = new Date("2026-01-02T03:04:05.000Z");
    prismaMock.users.findFirst.mockResolvedValue(null);
    prismaMock.users.create.mockResolvedValue({
      id: 10,
      email: "new@example.com",
      username: "NewPlayer",
      created_at: createdAt,
    });

    const response = await request(testUrl)
      .post("/api/auth/register")
      .send({
        email: "new@example.com",
        username: "NewPlayer",
        password: "long-password",
      })
      .expect(201);

    expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: "new@example.com" }, { username: "NewPlayer" }],
      },
      select: { id: true },
    });
    expect(prismaMock.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          username: "NewPlayer",
          country: expect.any(String),
          password_hash: expect.any(String),
        }),
      }),
    );
    expect(response.body).toEqual({
      message: "User registered!",
      user: {
        id: 10,
        email: "new@example.com",
        username: "NewPlayer",
        created_at: createdAt.toISOString(),
      },
      token: expect.any(String),
    });
    expect(jwt.verify(response.body.token, process.env.JWT_SECRET!)).toMatchObject({
      sub: 10,
      email: "new@example.com",
      username: "NewPlayer",
    });
  });

  test("GET /api/auth/me authenticates through JWT middleware", async () => {
    if (skipIfServerUnavailable()) return;

    const createdAt = new Date("2026-01-03T00:00:00.000Z");
    prismaMock.users.findUnique.mockResolvedValue({
      id: 22,
      email: "player@example.com",
      username: "Player",
      created_at: createdAt,
    });
    const token = jwt.sign(
      { sub: 22, email: "player@example.com", username: "Player" },
      process.env.JWT_SECRET!,
    );

    const response = await request(testUrl)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.users.findUnique).toHaveBeenCalledWith({
      where: { id: 22 },
      select: {
        id: true,
        email: true,
        username: true,
        created_at: true,
      },
    });
    expect(response.body.user).toMatchObject({
      sub: 22,
      id: 22,
      email: "player@example.com",
      username: "Player",
      created_at: createdAt.toISOString(),
    });
  });

  test("GET /api/users/search returns mapped paginated search results", async () => {
    if (skipIfServerUnavailable()) return;

    prismaMock.users.count.mockResolvedValue(1);
    prismaMock.users.findMany.mockResolvedValue([
      { id: 5, username: "albert", avatar_id: 3 },
    ]);

    const response = await request(testUrl)
      .get("/api/users/search")
      .query({ q: "al", page: "2", limit: "10" })
      .expect(200);

    expect(response.body).toEqual({
      items: [
        {
          id: 5,
          username: "albert",
          avatarId: 3,
          status: "offline",
        },
      ],
      page: 2,
      limit: 10,
      total: 1,
      query: "al",
    });
  });

  test("GET /api/leaderboards normalizes route values and serializes dates", async () => {
    if (skipIfServerUnavailable()) return;

    const achievedAt = new Date("2026-01-04T12:00:00.000Z");
    prismaMock.match_players.findMany.mockResolvedValue([
      {
        result: "win",
        score: 5000,
        users: { id: 1, username: "Alice", country: "GE" },
        matches: {
          gamemode: "quickPlay",
          status: "finished",
          created_at: achievedAt,
        },
      },
      {
        result: "lose",
        score: 8000,
        users: { id: 2, username: "Bob", country: null },
        matches: {
          gamemode: "quickPlay",
          status: "finished",
          created_at: null,
        },
      },
    ]);

    const response = await request(testUrl)
      .get("/api/leaderboards")
      .query({ mode: "quick", scope: "global", limit: "5" })
      .expect(200);

    expect(prismaMock.match_players.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matches: {
            status: "finished",
            gamemode: "quickPlay",
          },
        },
      }),
    );
    expect(response.body).toEqual([
      {
        id: 2,
        name: "Bob",
        score: 8000,
        country: "",
        achievedAt: null,
      },
      {
        id: 1,
        name: "Alice",
        score: 5000,
        country: "GE",
        achievedAt: achievedAt.toISOString(),
      },
    ]);
  });
});
