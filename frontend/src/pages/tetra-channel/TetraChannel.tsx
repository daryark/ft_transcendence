import { useNavigate } from "react-router-dom";
import "./TetraChannel.module.scss";

export default function TetraChannel() {
  const navigate = useNavigate();

  return (
    <div className="channel">
      
      {/* STATISTICS */}
      <div className="channel__block center">
        <button onClick={() => navigate("/channel/statistics")}>
          <h2>Statistics</h2>
          <p>Your game stats</p>
        </button>
      </div>

      {/* LEADERBOARDS */}
      <div className="channel__block center">
        <button onClick={() => navigate("/channel/leaderboards/40-lines/global")}>
          <h2>Leaderboards</h2>
          <p>Top players ranking</p>
        </button>
      </div>

      {/* ME + PLAYERS */}
      <div className="channel__row">
        <button onClick={() => navigate("/channel/me")}>
          <h2>Me</h2>
        </button>

        <button onClick={() => navigate("/channel/players")}>
          <h2>Players</h2>
        </button>
      </div>

      {/* ACHIEVEMENTS */}
      <div className="channel__block center">
        <button onClick={() => navigate("/channel/achievements")}>
          <h2>Achievements</h2>
        </button>
      </div>

    </div>
  );
}