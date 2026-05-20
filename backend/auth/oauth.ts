// Use global fetch available in Node 18+ (avoid adding node-fetch dependency)

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API_USER = "https://api.github.com/user";
const GITHUB_API_EMAILS = "https://api.github.com/user/emails";

export function buildGitHubAuthorizeUrl(state?: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;

  if (!clientId || !redirectUri) {
    throw new Error("GITHUB_CLIENT_ID or GITHUB_CALLBACK_URL is not set");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "user:email",
    allow_signup: "true",
  });

  if (state) params.append("state", state);

  return `${GITHUB_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeCodeForAccessToken(code: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GitHub OAuth env vars are not set");
  }

  const res = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to exchange code: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data.access_token as string;
}

export async function getGitHubProfile(accessToken: string) {
  const res = await fetch(GITHUB_API_USER, {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${res.status}`);
  }

  const profile = await res.json();
  return profile;
}

export async function getGitHubPrimaryEmail(accessToken: string) {
  const res = await fetch(GITHUB_API_EMAILS, {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub emails: ${res.status}`);
  }

  const emails = await res.json();
  // emails is array of { email, primary, verified, visibility }
  const primary = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified) || emails[0];
  return primary ? primary.email : null;
}

export default {
  buildGitHubAuthorizeUrl,
  exchangeCodeForAccessToken,
  getGitHubProfile,
  getGitHubPrimaryEmail,
};
