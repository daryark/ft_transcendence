import { Link, useNavigate } from "react-router-dom";
import { useNetworkStatus } from "../../network/NetworkProvider";
import "./SystemPage.scss";

export function ForbiddenPage() {
  return (
    <main className="system-page">
      <section>
        <span>403</span>
        <h1>Access denied</h1>
        <p>Your account does not have permission to open this page.</p>
        <Link to="/play">RETURN TO PLAY</Link>
      </section>
    </main>
  );
}

export function OfflinePage() {
  const navigate = useNavigate();
  const status = useNetworkStatus();

  return (
    <main className="system-page">
      <section>
        <span>{status === "reconnecting" ? "RECONNECTING" : "OFFLINE"}</span>
        <h1>
          {status === "reconnecting"
            ? "Restoring connection"
            : "Server unavailable"}
        </h1>
        <p>
          {status === "reconnecting"
            ? "Your session is being restored from the server."
            : "Check your network connection and try again."}
        </p>
        <button onClick={() => navigate(-1)} type="button">
          TRY AGAIN
        </button>
        <Link to="/play">RETURN TO PLAY</Link>
      </section>
    </main>
  );
}
