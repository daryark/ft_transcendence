import type { Request, Response } from "express";
import { randomBytes } from "crypto";
import * as oauth from "./oauth";
import { findOrCreateOAuthUser } from "../prisma/auth";

const OAUTH_STATE_COOKIE = "tetra_oauth_state";
const OAUTH_TTL_MS = 10 * 60 * 1000;
const oauthExchanges = new Map<string, { token: string; expiresAt: number }>();
const oauthStates = new Map<string, number>();

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

function pruneExpiredStates() {
  const now = Date.now();

  for (const [state, expiresAt] of oauthStates) {
    if (expiresAt <= now) {
      oauthStates.delete(state);
    }
  }
}

function getForwardedHeader(req: Request, name: string) {
  const value = req.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFrontendOrigin(req: Request) {
  const configured =
    process.env.FRONTEND_URL || process.env.FRONTEND_CALLBACK_URL;

  if (configured?.trim() && !configured.includes("<your-ip>")) {
    return configured.trim().replace(/\/$/, "");
  }

  const host = getForwardedHeader(req, "x-forwarded-host") || req.get("host");
  const proto =
    getForwardedHeader(req, "x-forwarded-proto") ||
    (req.secure ? "https" : req.protocol || "http");

  if (host) {
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  }

  return "http://localhost:5001";
}

function getGitHubCallbackUrl(req: Request) {
  return `${getFrontendOrigin(req)}/api/auth/github/callback`;
}

export function redirectToGitHub(req: Request, res: Response) {
  const state = randomBytes(32).toString("hex");
  pruneExpiredStates();
  oauthStates.set(state, Date.now() + OAUTH_TTL_MS);
  res.cookie(OAUTH_STATE_COOKIE, state, oauthCookieOptions(req));
  const url = oauth.buildGitHubAuthorizeUrl(state, getGitHubCallbackUrl(req));
  return res.redirect(url);
}

export async function githubCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  res.clearCookie(OAUTH_STATE_COOKIE, oauthCookieOptions(req));

  if (!code) {
    return res.status(400).json({ message: "Missing code" });
  }

  pruneExpiredStates();

  if (!state) {
    return res.status(400).json({ message: "Invalid OAuth state" });
  }

  if (!oauthStates.has(state)) {
    return res.status(400).json({ message: "Invalid OAuth state" });
  }

  oauthStates.delete(state);

  try {
    const accessToken = await oauth.exchangeCodeForAccessToken(
      code,
      getGitHubCallbackUrl(req),
    );
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

    const frontend = getFrontendOrigin(req);
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
