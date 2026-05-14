import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAnonymousUser,
  getSessionUser,
  saveSessionUser,
  type SessionUser,
} from "../../auth/session";
import "./Auth.scss";

type AuthMode = "login" | "register";

type AuthInput = {
  email: string;
  password: string;
  username?: string;
};

type AuthResponse = {
  message?: string;
  error?: string;
  user?: SessionUser | null;
};

const parseAuthResponse = async (res: Response): Promise<AuthResponse> => {
  try {
    return (await res.json()) as AuthResponse;
  } catch {
    return {};
  }
};

const requestAuth = async (
  mode: AuthMode,
  input: AuthInput
): Promise<SessionUser> => {
  const endpoint =
    mode === "login" ? "/api/auth/login" : "/api/auth/register";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await parseAuthResponse(res);

  if (!res.ok) {
    throw new Error(payload.error || payload.message || "Authentication failed");
  }

  if (!payload.user) {
    throw new Error(
      mode === "login"
        ? "Invalid email or password"
        : "Registration failed"
    );
  }

  return payload.user;
};

export const registerUser = async (data: {
  email: string;
  password: string;
  username: string;
}) => requestAuth("register", data);

export const loginUser = async (data: {
  email: string;
  password: string;
}) => requestAuth("login", data);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSessionUser()) {
      navigate("/play", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const user = isLogin
        ? await loginUser({ email, password })
        : await registerUser({ email, password, username });

      saveSessionUser(user);

      navigate("/play");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymous = () => {
    saveSessionUser(createAnonymousUser());
    navigate("/play");
  };

  return (
    <div className="auth">
      {/* left*/}
      <div className="auth__left">
        <div className="auth__tetris-animation">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="tetris-block">
              {["🟦", "🟧", "🟪", "🟩", "🟥"][i % 5]}
            </div>
          ))}
        </div>
        <div className="auth__overlay">
          <h1>TETRA</h1>
          <p>amazing game in this world</p>
        </div>
      </div>

      {/* rigth */}
      <div className="auth__right">
        <div className="auth__card">
          {/* header form */}
          <div className="auth__header">
            <h2>{isLogin ? "Welcome back" : "Create account"}</h2>
            <p>{isLogin ? "Enter your credentials" : "Start your journey"}</p>
          </div>

          {/* switch parts login/registration */}
          <div className="auth__tabs">
            <button
              type="button"
              className={isLogin ? "active" : ""}
              onClick={() => {
                setIsLogin(true);
                setError("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={!isLogin ? "active" : ""}
              onClick={() => {
                setIsLogin(false);
                setError("");
              }}
            >
              Register
            </button>
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="auth__form">
            {!isLogin && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                minLength={3}
                maxLength={100}
                required={!isLogin}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              required
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              minLength={isLogin ? 1 : 8}
              maxLength={128}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="auth__submit" type="submit" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Login" : "Create account"}
            </button>

            {error && <p className="auth__error">{error}</p>}
          </form>

          <div className="auth__divider">
            <span>or continue with</span>
          </div>

          {/* Oauth buttons */}
          <div className="auth__oauth">
            <button className="oauth github" type="button">
              GitHub
            </button>

            <button className="oauth forty-two" type="button">
              42
            </button>
          </div>

          {/* anonymous */}
          <button
            className="auth__anonymous"
            type="button"
            onClick={handleAnonymous}
          >
            Play as anonymous
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
