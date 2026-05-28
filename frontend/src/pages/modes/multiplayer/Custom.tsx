import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MultiplayerMode.scss";

export default function Custom() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("Manya's Room");
  const [visibility, setVisibility] = useState("public");

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
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
            />
          </label>
          <label className="mp-create-row">
            Visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
        </div>
        <div className="mp-create-actions">
          <button type="button" disabled={!roomName.trim()}>
            CREATE
          </button>
          <button type="button" onClick={() => navigate("/play/multiplayer/rooms")}>
            BROWSE ROOMS
          </button>
        </div>
      </main>
    </section>
  );
}
