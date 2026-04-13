


import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import "./Leaderboard.scss";

type Player = {
  id: number;
  name: string;
  score: number;
  country: string;
};

// request api?
const fetchLeaderboard = async (mode: string, scope: string) => {
  const res = await fetch(
    `/api/leaderboards?mode=${mode}&scope=${scope}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch leaderboard");
  }

  return res.json();
};

export default function Leaderboard() {
  const { mode, scope } = useParams<{
    mode: string;
    scope: string;
  }>();

  const navigate = useNavigate();

  const currentMode = mode || "40-lines";
  const currentScope = scope || "global";

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // loading data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchLeaderboard(currentMode, currentScope);

        setPlayers(data);
      } catch (err) {
        setError("Error loading leaderboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentMode, currentScope]);

  return (
    <div className="leaderboard">

      {/* MODE */}
      <div className="leaderboard__row">
        <button
          className={currentMode === "40-lines" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/40-lines/${currentScope}`)
          }
        >
          40 Lines
        </button>

        <button
          className={currentMode === "quick" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/quick/${currentScope}`)
          }
        >
          Quick
        </button>

        <button
          className={currentMode === "blitz" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/blitz/${currentScope}`)
          }
        >
          Blitz
        </button>
      </div>

      {/* SCOPE */}
      <div className="leaderboard__row">
        <button
          className={currentScope === "global" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/global`)
          }
        >
          World
        </button>

        <button
          className={currentScope === "country" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/country`)
          }
        >
          Country
        </button>

        <button
          className={currentScope === "friends" ? "active" : ""}
          onClick={() =>
            navigate(`/channel/leaderboards/${currentMode}/friends`)
          }
        >
          Friends
        </button>
      </div>

      {/* STATES */}
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}

      {/* TABLE */}
      {!loading && !error && (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Country</th>
              <th>Score</th>
            </tr>
          </thead>

          <tbody>
            {players.map((p, index) => (
              <tr key={p.id}>
                <td>{index + 1}</td>
                <td>{p.name}</td>
                <td>{p.country}</td>
                <td>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


// test 
// import { useParams, useNavigate } from "react-router-dom";
// import type {Player} from "./test";
// import {basePlayers} from "./test"

// import "./Leaderboard.scss";

// export default function Leaderboard() {
//   const { mode = "40-lines", scope = "global" } = useParams();
//   const navigate = useNavigate();

//   const getPlayersByMode = () => {
//     switch (mode) {
//       case "blitz":
//         return basePlayers.map((p) => ({
//           ...p,
//           score: p.score + 2000,
//         }));
//       case "quick":
//         return basePlayers.map((p) => ({
//           ...p,
//           score: p.score - 1500,
//         }));
//       default:
//         return basePlayers;
//     }
//   };

//   const getPlayersByScope = (players: Player[]) => {
//     switch (scope) {
//       case "country":
//         return players.filter((p) => p.country === "DE");
//       case "friends":
//         return players.slice(0, 5);
//       default:
//         return players;
//     }
//   };

//   const players = getPlayersByScope(getPlayersByMode());

//   return (
//     <div className="leaderboard">

//       {/* GAME MODE */}
//       <div className="leaderboard__row">
//         <button onClick={() => navigate("/channel/leaderboards/40-lines/" + scope)}>
//           40 Lines
//         </button>

//         <button onClick={() => navigate("/channel/leaderboards/quick/" + scope)}>
//           Quick
//         </button>

//         <button onClick={() => navigate("/channel/leaderboards/blitz/" + scope)}>
//           Blitz
//         </button>
//       </div>

//       {/* SCOPE */}
//       <div className="leaderboard__row">
//         <button onClick={() => navigate("/channel/leaderboards/" + mode + "/global")}>
//           World
//         </button>

//         <button onClick={() => navigate("/channel/leaderboards/" + mode + "/country")}>
//           Country
//         </button>

//         <button onClick={() => navigate("/channel/leaderboards/" + mode + "/friends")}>
//           Friends
//         </button>
//       </div>

//       {/* TABLE */}
//       <table className="leaderboard__table">
//         <thead>
//           <tr>
//             <th>#</th>
//             <th>Player</th>
//             <th>Score</th>
//           </tr>
//         </thead>

//         <tbody>
//           {players.map((p, index) => (
//             <tr key={p.id}>
//               <td>{index + 1}</td>
//               <td>{p.name}</td>
//               <td>{p.score}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//     </div>
//   );
// }