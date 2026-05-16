import createEngine from "../engine/tetrisEngline";
import { initGame } from "../engine/state";

import RoomService from "../../services/roomService";
import Room from "../room";

export default function startGame(room: Room, roomService: RoomService) {
  if (room.status === "playing") return;

  room.status = 'playing';

  const { boardHeight, boardWidth } = room.gameConfig.general;
  room.state = initGame(boardHeight, boardWidth);

  room.engine = createEngine(room, roomService);
  roomService.broadcast(room.id, "game:start", {
    roomId: room.id,
    state: room.state,
    config: room.gameConfig
  });
}
