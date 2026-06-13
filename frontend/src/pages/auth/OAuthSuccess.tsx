import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession } from "../../auth/session";

type JwtPayload = {
  sub: number | string;
  email?: string;
  username?: string;
  exp?: number;
  iat?: number;
};

function parseJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) return null;

    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );

    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isExpired(payload?: JwtPayload | null) {
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

export default function OAuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      navigate("/", { replace: true });
      return;
    }

    window.history.replaceState(null, "", "/auth/callback");

    const finishOAuth = async () => {
      try {
        const response = await fetch("/api/auth/github/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error("OAuth exchange failed");
        }

        const data = (await response.json()) as { token?: string };
        const token = data.token;
        const payload = token ? parseJwt(token) : null;
        const userId = Number(payload?.sub);

        if (
          !token ||
          !payload ||
          isExpired(payload) ||
          !Number.isInteger(userId) ||
          userId <= 0 ||
          !payload.username
        ) {
          throw new Error("Invalid OAuth session");
        }

        saveSession({
          token,
          user: {
            id: userId,
            email: payload.email ?? "",
            username: payload.username,
            created_at: null,
          },
        });

        navigate("/play", { replace: true });
      } catch {
        navigate("/", { replace: true });
      }
    };

    void finishOAuth();
  }, [navigate]);

  return <div>Signing you in with GitHub...</div>;
}
