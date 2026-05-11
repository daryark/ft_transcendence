import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./prisma";

/**
 * Public user shape returned by auth functions
 */
export type PublicUser = {
  id: number;
  email: string;
  username: string;
  created_at: Date | null;
};

const registerSchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthResult = {
  user: PublicUser;
  token: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return secret;
}

function createAuthToken(user: PublicUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    }
  );
}

/**
 * Register a new user.
 * - Validates input with Zod
 * - Ensures email/username uniqueness
 * - Hashes the password with bcrypt
 * - Returns the created public user record
 *
 * Example:
 * const user = await registerUser({ email: 'a@b.com', username: 'foo', password: 'longpass' });
 */
export async function registerUser(rawInput: RegisterInput): Promise<AuthResult> {
  const input = registerSchema.parse(rawInput);

  const existing = await prisma.users.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Email or username already exists");
  }

  const password_hash = await bcrypt.hash(input.password, 10);

  const user = await prisma.users.create({
    data: {
      email: input.email,
      username: input.username,
      password_hash,
    },
    select: {
      id: true,
      email: true,
      username: true,
      created_at: true,
    },
  });

  return {
    user,
    token: createAuthToken(user),
  };
}

/**
 * Login a user by email and password.
 * - Validates input with Zod
 * - Verifies password using bcrypt
 * - Returns public user on success, or null on failure
 *
 * Example:
 * const user = await loginUser({ email: 'a@b.com', password: 'longpass' });
 */
export async function loginUser(rawInput: LoginInput): Promise<AuthResult | null> {
  const input = loginSchema.parse(rawInput);

  const user = await prisma.users.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      username: true,
      created_at: true,
      password_hash: true,
    },
  });

  if (!user) {
    return null;
  }

  const ok = await bcrypt.compare(input.password, user.password_hash);
  if (!ok) {
    return null;
  }

  const publicUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    created_at: user.created_at,
  };

  return {
    user: publicUser,
    token: createAuthToken(publicUser),
  };
}