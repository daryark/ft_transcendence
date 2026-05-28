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
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    window.history.replaceState(null, "", "/auth/callback");

    const payload = parseJwt(token);

    // ❌ invalid token
    if (!payload) {
      navigate("/", { replace: true });
      return;
    }

    // ❌ expired token
    if (isExpired(payload)) {
      navigate("/", { replace: true });
      return;
    }

    // ✅ save session
    saveSession({
      token,
      user: {
        id: Number(payload.sub),
        email: payload.email ?? "",
        username: payload.username ?? "",
        created_at: null,
      },
    });

    navigate("/play", { replace: true });
  }, [navigate]);

  return <div>Signing you in with GitHub...</div>;
}
