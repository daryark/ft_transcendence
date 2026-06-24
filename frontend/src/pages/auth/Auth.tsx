import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiJson } from "../../api/client";
import {
  createAnonymousSession,
  getSessionUser,
  saveSession,
  type SessionData,
  type SessionUser,
} from "../../auth/session";
import "./Auth.scss";

type AuthMode = "login" | "register";

type AuthResponse = {
  message?: string;
  error?: string;
  user?: unknown;
  token?: unknown;
};

type AuthRequestInput = Record<string, string | undefined>;

const COUNTRY_LOOKUP_TIMEOUT_MS = 3000;
const COUNTRY_COOKIE_NAME = "tetra_country";

function setCountryCookie(country: string | null) {
  if (!country) {
    document.cookie = `${COUNTRY_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COUNTRY_COOKIE_NAME}=${encodeURIComponent(country)}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
}

async function resolveBrowserCountry(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/country", {
      method: "GET",
      signal: AbortSignal.timeout(COUNTRY_LOOKUP_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { country?: string | null };
    const country = payload.country?.trim();
    return country && country.length > 0 ? country.slice(0, 100) : null;
  } catch (error) {
    return null;
  }
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "number" &&
    typeof user.email === "string" &&
    typeof user.username === "string" &&
    (typeof user.created_at === "string" || user.created_at === null)
  );
}

async function requestAuth(
  mode: AuthMode,
  input: AuthRequestInput,
): Promise<SessionData> {
  const response = await apiJson<AuthResponse>(
    mode === "login" ? "/api/auth/login" : "/api/auth/register",
    {
      method: "POST",
      skipAuth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!isSessionUser(response.user)) {
    throw new Error(response.error || response.message || "Invalid auth response");
  }

  if (response.token !== undefined && typeof response.token !== "string") {
    throw new Error("Invalid authentication token");
  }

  return {
    user: response.user,
    token: response.token,
  };
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const returnPath = useMemo(() => {
    if (
      typeof location.state === "object" &&
      location.state !== null &&
      "from" in location.state &&
      typeof location.state.from === "string" &&
      location.state.from.startsWith("/")
    ) {
      return location.state.from;
    }
    return "/play";
  }, [location.state]);

  useEffect(() => {
    if (getSessionUser()) navigate(returnPath, { replace: true });
  }, [navigate, returnPath]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      let session: SessionData;
      
      if (mode === "login") {
        session = await requestAuth("login", {
          ...(login.includes("@")
            ? { email: login.trim() }
            : { username: login.trim() }),
          password,
        });
      } else {
        const browserCountry = await resolveBrowserCountry();
        session = await requestAuth("register", {
          email: email.trim(),
          password,
          username: username.trim(),
          country: browserCountry ?? undefined,
        });
      }

      saveSession(session);
      navigate(returnPath, { replace: true });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__left">
        <div className="auth__tetris-animation" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => (
            <div className="tetris-block" key={index}>
              {["I", "O", "T", "S", "Z"][index % 5]}
            </div>
          ))}
        </div>
        <div className="auth__overlay">
          <h1>TETRA</h1>
          <p>FAST, SOCIAL, COMPETITIVE BLOCK STACKING</p>
        </div>
      </div>

      <div className="auth__right">
        <div className="auth__card">
          <div className="auth__header">
            <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
            <p>
              {mode === "login"
                ? "Enter your credentials"
                : "Start your journey"}
            </p>
          </div>

          <div className="auth__tabs">
            {(["login", "register"] as AuthMode[]).map((nextMode) => (
              <button
                className={mode === nextMode ? "active" : ""}
                key={nextMode}
                onClick={() => {
                  setMode(nextMode);
                  setError("");
                }}
                type="button"
              >
                {nextMode}
              </button>
            ))}
          </div>

          <form className="auth__form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <input
                autoComplete="username"
                maxLength={100}
                minLength={3}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                required
                value={username}
              />
            )}
            {mode === "login" ? (
              <input
                autoComplete="username"
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Username or email"
                required
                value={login}
              />
            ) : (
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                required
                type="email"
                value={email}
              />
            )}
            <div className="auth__password-field">
              <input
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                maxLength={128}
                minLength={mode === "login" ? 1 : 8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="auth__password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="20"
                  viewBox="0 0 24 24"
                  width="20"
                >
                  <path
                    d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  {!showPassword && (
                    <path
                      d="M4 20 20 4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  )}
                </svg>
              </button>
            </div>
            <button className="auth__submit" disabled={loading} type="submit">
              {loading
                ? "LOADING..."
                : mode === "login"
                  ? "LOGIN"
                  : "CREATE ACCOUNT"}
            </button>
            {error && (
              <p className="auth__error" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="auth__divider">
            <span>or continue with</span>
          </div>
          <div className="auth__oauth">
            <button
              className="oauth github"
              onClick={async () => {
                window.sessionStorage.setItem(
                  "tetra-auth-return-path",
                  returnPath,
                );
                setCountryCookie(await resolveBrowserCountry());
                window.location.href = "/api/auth/github";
              }}
              type="button"
            >
              GitHub
            </button>
          </div>
          <button
            className="auth__anonymous"
            onClick={() => {
              saveSession(createAnonymousSession());
              navigate("/play", { replace: true });
            }}
            type="button"
          >
            Play as anonymous
          </button>
          <p className="auth__legal">
            By continuing, you agree to the{" "}
            <Link to="/terms-of-service">Terms of Service</Link> and
            acknowledge the <Link to="/privacy-policy">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
