import { useNavigate } from "react-router-dom";
import "./MultiplayerMode.scss";

const quickMods = ["IV", "K", "X", "T", "V", "S", "//", "//", "//", "C"];

export default function Quick() {
  const navigate = useNavigate();

  return (
    <section className="mp-page mp-page--quick">
      <button className="mp-back" type="button" onClick={() => navigate(-1)}>
        EXIT
      </button>

      <main className="mp-center" aria-label="Quick Play">
        <article className="mp-card">
          <span className="mp-card__kicker">SPECTATE</span>
          <p>
            Welcome to the Zenith Tower! Send lines and KO enemies to scale the
            tower. The further up the tower, the stronger the opponents.
          </p>
          <p>Leaderboards reset every week. How far can you get?</p>
          <div className="mp-best">
            This week's personal best
            <strong>566.2 M</strong>
          </div>
        </article>

        <button className="mp-start" type="button">
          START
        </button>

        <div className="mp-mods" aria-label="Quick Play modifiers">
          <div className="mp-mod-stack">
            {quickMods.map((mod, index) => (
              <span className="mp-mod-card" key={`${mod}-${index}`}>
                {mod}
              </span>
            ))}
          </div>
          <div className="mp-mod-footer">ADD OR REMOVE MODS</div>
        </div>
      </main>

    </section>
  );
}
