import { initGame } from "../engine/state";

module.exports = function startGame(room, roomService) {
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
