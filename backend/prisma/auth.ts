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
    email: z.string().trim().email().optional(),
    username: z.string().trim().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((v) => !!(v.email || v.username), {
    message: "Either email or username is required",
    path: ["email", "username"],
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

export function createAuthToken(user: PublicUser): string {
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

/**
 * Find an existing user by email, or create a new user for OAuth sign-in.
 * Since the current `users` model requires a `password_hash`, a random
 * password is generated for accounts created via OAuth.
 */
export async function findOrCreateOAuthUser(
  provider: string,
  providerId: string,
  email?: string | null,
  username?: string | null
): Promise<AuthResult> {
  // 1) Check if this oauth account is already linked
  const existingLink: Array<{ user_id: number }> = (await prisma.$queryRaw`
    SELECT user_id FROM oauth_accounts WHERE provider = ${provider} AND provider_user_id = ${providerId} LIMIT 1
  `) as any;

  if (existingLink && existingLink.length > 0 && existingLink[0].user_id) {
    const userId = existingLink[0].user_id as number;
    const existingUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, created_at: true },
    });

    if (existingUser) {
      return { user: existingUser, token: createAuthToken(existingUser) };
    }
  }

  // 2) Try to find a user by email to link the provider
  if (email) {
    const existing = await prisma.users.findUnique({
      where: { email },
      select: { id: true, email: true, username: true, created_at: true },
    });

    if (existing) {
      // link provider -> user
      try {
        await prisma.$executeRaw`
          INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_data)
          VALUES (${existing.id}, ${provider}, ${providerId}, ${JSON.stringify({ email, username })}::jsonb)
          ON CONFLICT (provider, provider_user_id) DO NOTHING
        `;
      } catch (e) {
        // ignore linking errors
      }

      return { user: existing, token: createAuthToken(existing) };
    }
  }

  // 3) Create a new user and then link the oauth account
  // Build a username candidate
  let baseUsername = username || (email ? email.split("@")[0] : `${provider}_${providerId}`);
  baseUsername = baseUsername.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 30) || `${provider}_${providerId}`;

  let candidate = baseUsername;
  let suffix = 0;
  while (await prisma.users.findFirst({ where: { username: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${baseUsername}${suffix}`;
  }

  const randomPassword = (await import("crypto")).randomBytes(16).toString("hex");
  const password_hash = await bcrypt.hash(randomPassword, 10);

  const created = await prisma.users.create({
    data: {
      email: email ?? `${provider}_${providerId}@noemail.local`,
      username: candidate,
      password_hash,
    },
    select: { id: true, email: true, username: true, created_at: true },
  });

  try {
    await prisma.$executeRaw`
      INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_data)
      VALUES (${created.id}, ${provider}, ${providerId}, ${JSON.stringify({ email, username })}::jsonb)
      ON CONFLICT (provider, provider_user_id) DO NOTHING
    `;
  } catch (e) {
    // ignore
  }

  return {
    user: created,
    token: createAuthToken(created),
  };
}