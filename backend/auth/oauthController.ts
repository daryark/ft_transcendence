import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import * as oauth from "./oauth";
import { findOrCreateOAuthUser } from "../prisma/auth";

const OAUTH_STATE_COOKIE = "tetra_oauth_state";
const OAUTH_TTL_MS = 10 * 60 * 1000;
const oauthExchanges = new Map<string, { token: string; expiresAt: number }>();

function getCookie(req: Request, name: string) {
  const cookies = req.headers.cookie?.split(";") ?? [];

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function oauthCookieOptions(req: Request) {
  return {
    httpOnly: true,
    maxAge: OAUTH_TTL_MS,
    sameSite: "lax" as const,
    secure: req.secure || process.env.NODE_ENV === "production",
    path: "/api/auth/github/callback",
  };
}

function pruneExpiredExchanges() {
  const now = Date.now();

  for (const [code, exchange] of oauthExchanges) {
    if (exchange.expiresAt <= now) {
      oauthExchanges.delete(code);
    }
  }
}

export function redirectToGitHub(req: Request, res: Response) {
  const state = randomBytes(32).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, oauthCookieOptions(req));
  const url = oauth.buildGitHubAuthorizeUrl(state);
  return res.redirect(url);
}

export async function githubCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const expectedState = getCookie(req, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, oauthCookieOptions(req));

  if (!code) {
    return res.status(400).json({ message: "Missing code" });
  }

  if (!state || !expectedState || state !== expectedState) {
    return res.status(400).json({ message: "Invalid OAuth state" });
  }

  try {
    const accessToken = await oauth.exchangeCodeForAccessToken(code);
    const profile = await oauth.getGitHubProfile(accessToken);
    let email: string | null = profile.email ?? null;

    if (!email) {
      email = await oauth.getGitHubPrimaryEmail(accessToken);
    }

    const providerId = String(profile.id || profile.node_id || profile.login);
    const username = profile.login || undefined;

    const { user, token } = await findOrCreateOAuthUser({
      provider: "github",
      providerId,
      email,
      username,
      request: req,
    });

    const frontend = process.env.FRONTEND_URL || process.env.FRONTEND_CALLBACK_URL || "http://localhost:5173";
    const exchangeCode = randomBytes(32).toString("hex");
    pruneExpiredExchanges();
    oauthExchanges.set(exchangeCode, {
      token,
      expiresAt: Date.now() + OAUTH_TTL_MS,
    });
    const redirectUrl = `${frontend.replace(/\/$/, "")}/auth/callback?code=${exchangeCode}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return res.status(500).json({ message: "OAuth failed", error: String(error) });
  }
}

export function exchangeOAuthCode(req: Request, res: Response) {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  pruneExpiredExchanges();
  const exchange = oauthExchanges.get(code);

  if (!exchange) {
    return res.status(400).json({ message: "Invalid or expired OAuth code" });
  }

  oauthExchanges.delete(code);
  return res.status(200).json({ token: exchange.token });
}

export default { redirectToGitHub, githubCallback, exchangeOAuthCode };
module.exports = { redirectToGitHub, githubCallback, exchangeOAuthCode };
