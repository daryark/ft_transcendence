import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSocket,
  subscribeToSocket,
} from "../../../socket/socketClient";
import "./MultiplayerMode.scss";

type PublicRoomListItem = {
  id: string;
  name: string;
  status: "lobby" | "playing" | "ended";
  hostName: string | null;
  players: number;
  spectators: number;
  maxPlayers: number | null;
};

function formatPlayerCount(room: PublicRoomListItem) {
  if (room.spectators > 0) {
    return `${room.players} + ${room.spectators}`;
  }

  return String(room.players);
}

function formatRoomMeta(room: PublicRoomListItem) {
  const status = room.status === "playing" ? "INGAME" : "LOBBY";
  const host = room.hostName ? ` - ${room.hostName}` : "";

  return `${status}${host} - ${room.id}`;
}

export default function Rooms() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<PublicRoomListItem[]>([]);
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(
    () =>
      subscribeToSocket(() => {
        setSocket(getSocket());
      }),
    [],
  );

  useEffect(() => {
    if (!socket) return undefined;

    const handleRoomsUpdate = (payload: PublicRoomListItem[]) => {
      setRooms(payload);
    };

    socket.on("rooms:update", handleRoomsUpdate);
    socket.emit("rooms:list");

    return () => {
      socket.off("rooms:update", handleRoomsUpdate);
    };
  }, [socket]);

  const refreshRooms = () => {
    socket?.emit("rooms:list");
  };

  return (
    <section className="mp-page mp-page--rooms">
      <button
        className="mp-back"
        type="button"
        onClick={() => navigate("/play/multiplayer")}
      >
        BACK
      </button>

      <main className="mp-rooms-wrap" aria-label="Room Listing">
        <button className="mp-refresh" onClick={refreshRooms} type="button">
          REFRESH
        </button>

        <article className="mp-room-hero">
          <div className="mp-room-logo">RYL</div>
          <div>
            <h1>ROYALE</h1>
            <p>Face off against the best in a single lobby shared by all.</p>
          </div>
          <div className="mp-room-count">{rooms.length}</div>
        </article>

        <div className="mp-room-list">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <button
                className="mp-room-row"
                key={room.id}
                onClick={() => navigate(`/play/multiplayer/custom/${room.id}`)}
                type="button"
              >
                <span>
                  <h2>{room.name}</h2>
                  <p>{formatRoomMeta(room)}</p>
                </span>
                <span className="mp-room-players">
                  {formatPlayerCount(room)}
                </span>
              </button>
            ))
          ) : (
            <div className="mp-room-empty">NO PUBLIC ROOMS</div>
          )}
        </div>
      </main>
    </section>
  );
}
