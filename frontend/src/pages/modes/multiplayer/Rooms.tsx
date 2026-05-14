import { useNavigate } from "react-router-dom";
import "./MultiplayerMode.scss";

const rooms = [
  ["24/7 | STACKING TIME", "INGAME - KIMJOOHYEON", "6+5"],
  ["4W NOOB JOIN, PRO BAN. STRICTER.", "LOBBY - JKUG", "9"],
  ["4WIDE", "INGAME - NBTX", "4"],
  ["SS AND U 1VS1", "INGAME - CYNN", "2/2+2"],
  ["LRIPBOZO'S ROOM", "INGAME - TRAH", "4"],
  ["4W GRAVITY 100", "INGAME - AND BELOW - ROOMID", "2+1"],
  ["PANINI", "INGAME - PAINANDSUFFERING", "2/2+1"],
  ["ANDAYEYO'S ROOM", "INGAME - AQQX", "3"],
  ["UX S1", "INGAME - WQPL", "2/2+1"],
  ["DULGI158'S PRIVATE ROOM", "INGAME - GVNY", "2/2"],
  ["CLANGUAGE00'S ROOM", "INGAME - CCFR", "2/1"],
];

export default function Rooms() {
  const navigate = useNavigate();

  return (
    <section className="mp-page mp-page--rooms">
      <button className="mp-back" type="button" onClick={() => navigate(-1)}>
        BACK
      </button>

      <main className="mp-rooms-wrap" aria-label="Room Listing">
        <button className="mp-refresh" type="button">
          REFRESH
        </button>

        <article className="mp-room-hero">
          <div className="mp-room-logo">RYL</div>
          <div>
            <h1>ROYALE</h1>
            <p>Face off against the best in a single lobby shared by all.</p>
          </div>
          <div className="mp-room-count">2</div>
        </article>

        <div className="mp-room-list">
          {rooms.map(([name, meta, players]) => (
            <button className="mp-room-row" type="button" key={name}>
              <span>
                <h2>{name}</h2>
                <p>{meta}</p>
              </span>
              <span className="mp-room-players">{players}</span>
            </button>
          ))}
        </div>
      </main>

    </section>
  );
}
