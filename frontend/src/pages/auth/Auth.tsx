import { useState } from "react";
import "./Auth.scss";

//tmp // addd to folder with sersises
export const registerUser = async (data: {
  email: string;
  password: string;
  username: string;
}) => {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Registration failed");
  }

  return res.json();
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    //only resistation test
    if (isLogin) return;

    try {
      setLoading(true);
      setError("");

      const data = await registerUser({
        email,
        password,
        username,
      });

      // save token ? update when will you and create
      // localStorage.setItem("token", data.token);

      // redicect
      window.location.href = "/play";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymous = () => {
    //tmp
    console.log("Continue as Anonymous");
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
              className={isLogin ? "active" : ""}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>

            <button
              className={!isLogin ? "active" : ""}
              onClick={() => setIsLogin(false)}
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
                onChange={(e) => setUsername(e.target.value)}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="auth__submit" disabled={loading}>
              {loading ? "Loading..." : "Create account"}
            </button>

            {error && <p className="auth__error">{error}</p>}
          </form>

          <div className="auth__divider">
            <span>or continue with</span>
          </div>

          {/* Oauth buttons */}
          <div className="auth__oauth">
            <button className="oauth github">GitHub</button>

            <button className="oauth forty-two">42</button>
          </div>

          {/* anonymous */}
          <button className="auth__anonymous" onClick={handleAnonymous}>
            Play as anonymous
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
