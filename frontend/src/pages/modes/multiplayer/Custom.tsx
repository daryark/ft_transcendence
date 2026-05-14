import { useNavigate } from "react-router-dom";
import "./MultiplayerMode.scss";

export default function Custom() {
  const navigate = useNavigate();

  return (
    <section className="mp-page mp-page--quick">
      <button className="mp-back" type="button" onClick={() => navigate(-1)}>
        BACK
      </button>

      <main className="mp-create-card" aria-label="Custom Game">
        <h1>CREATE ROOM</h1>
        <div className="mp-create-grid">
          <label className="mp-create-row">
            Room name
            <input defaultValue="Manya's Room" />
          </label>
          <label className="mp-create-row">
            Visibility
            <select defaultValue="public">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        </div>
        <div className="mp-create-actions">
          <button type="button">CREATE</button>
          <button type="button">BROWSE ROOMS</button>
        </div>
      </main>
    </section>
  );
}
