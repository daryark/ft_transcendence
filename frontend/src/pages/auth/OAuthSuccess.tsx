import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
// import { saveSession } from "../auth/session";
import { saveSession } from "../../auth/session";

const OAuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const token = params.get("token");
    const userRaw = params.get("user");

    if (!token || !userRaw) {
      navigate("/auth");
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));

      saveSession({
        token,
        user,
      });

      navigate("/play");
    } catch {
      navigate("/auth");
    }
  }, [navigate]);

  return <p>Signing in with GitHub...</p>;
};

export default OAuthSuccess;