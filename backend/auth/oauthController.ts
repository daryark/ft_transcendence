import type { Request, Response } from "express";
import * as oauth from "./oauth";
import { findOrCreateOAuthUser } from "../prisma/auth";

export function redirectToGitHub(req: Request, res: Response) {
  const state = undefined; // could generate and store state for CSRF protection
  const url = oauth.buildGitHubAuthorizeUrl(state);
  return res.redirect(url);
}

export async function githubCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : null;

  if (!code) {
    return res.status(400).json({ message: "Missing code" });
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

    // Simple redirect with token in query. Consider setting an HttpOnly cookie instead.
    const redirectUrl = `${frontend.replace(/\/$/, "")}/auth/callback?token=${encodeURIComponent(token)}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return res.status(500).json({ message: "OAuth failed", error: String(error) });
  }
}

export default { redirectToGitHub, githubCallback };
module.exports = { redirectToGitHub, githubCallback };
