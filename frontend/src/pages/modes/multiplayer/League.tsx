import { useNavigate } from "react-router-dom";
import "./MultiplayerMode.scss";

export default function League() {
  const navigate = useNavigate();

  return (
    <section className="mp-page mp-page--league">
      <button className="mp-back" type="button" onClick={() => navigate(-1)}>
        BACK
      </button>

      <div className="mp-league-rank">
        <div>
          <div className="mp-tr">
            1101<small>TR</small>
          </div>
          <div className="mp-league-stats">
            Glicko: 912+/-87 - Games won: 9 / 26 (34.61%)
          </div>
        </div>
        <div className="mp-rank-mark">
          <span>No.33396</span>
          <span>C</span>
        </div>
      </div>

      <div className="mp-queue">
        13 <span>IN QUEUE -</span> 527 <span>IN GAME</span>
        <small>Estimated queue time: 39 seconds</small>
      </div>

      <button className="mp-league-action" type="button">
        ENTER MATCHMAKING
        <span>Leaving early is punished</span>
      </button>

      <article className="mp-help">
        <h2>HOW DOES IT WORK?</h2>
        <p>
          Enter matchmaking and you will be matched up with a player of similar
          skill in a game of 1v1 versus. Win games to gain TR and rank up. Play
          at least 10 games to see your TR and enter the global leaderboards.
        </p>
      </article>

    
    </section>
  );
}
