import { Socket } from "socket.io";
import { createConfig } from "../../../config/configBase";
import type Config from "../../../config/config.types";
import type { ConfigPatch } from "../../../config/config.schema";
import type Room from "../../room";
import type RoomService from "../../../services/roomService";
import type { RoomServiceRoomState } from "../../../services/roomService";
import type PlayerService from "../../../services/playerService";
import type Player from "../../player";
import startGame from "../../match/startGame";
import { emitError } from "../../../../sockets/gameHandlers";

type QueueEntry = {
  socket: Socket;
  player: Player;
  playerId: string;
  joinedAt: number;
};

const leagueQueue: QueueEntry[] = [];

function removeQueuedPlayer(playerId: string) {
  const index = leagueQueue.findIndex((entry) => entry.playerId === playerId);
  if (index >= 0) {
    leagueQueue.splice(index, 1);
  }
}

function createLeagueRoom(roomService: RoomService, entries: [QueueEntry, QueueEntry]) {
  const config: Config = createConfig("league");
  const room: Room = roomService.createRoom(config);

  for (const entry of entries) {
    roomService.addPlayer(room.id, entry.player);
    entry.socket.join(room.id);
    entry.socket.data.roomId = room.id;
    entry.socket.data.role = "player";
  }

  startGame(room, roomService);
  return room;
}

export default function join(
  socket: Socket,
  { roomService, playerService }: { roomService: RoomService; playerService: PlayerService },
  _payload: ConfigPatch = {},
): RoomServiceRoomState | null {
  const identity = socket.data.identity;
  if (!identity || identity.type !== "registered") {
    emitError(socket, "LEAGUE_REGISTERED_ONLY");
    return null;
  }

  const player = playerService.get(identity.id);
  if (!player || !player.profile) {
    emitError(socket, "PLAYER_NOT_FOUND");
    return null;
  }

  removeQueuedPlayer(String(player.id));
  leagueQueue.push({
    socket,
    player,
    playerId: String(player.id),
    joinedAt: Date.now(),
  });
  socket.once("disconnect", () => {
    removeQueuedPlayer(String(player.id));
  });

  socket.emit("room:update", {
    status: "waiting",
    queueSize: leagueQueue.length,
  });

  if (leagueQueue.length < 2) {
    return null;
  }

  const nextPair = leagueQueue.splice(0, 2) as [QueueEntry, QueueEntry];
  const room = createLeagueRoom(roomService, nextPair);
  return roomService.getRoomState(room.id);
}

module.exports = {
  join,
};
