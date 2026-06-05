import createMatchService from "../../services/matchService";

import RoomService from "../../services/roomService";
import Room from "../room";

export default function startGame(room: Room, roomService: RoomService) {
  if (room.status === "playing") return;
  //change later logics up to the mode:
  // - on custom if room starts to play (front updates to spectator or zen buttons) -> auto end this mode on end of game in that case only!
  // - for quickplay just adds to the pool
  // - for league and solo -> error, no roomId exposed to the client.


  room.match = createMatchService(room, roomService);
  room.match.start();
}
