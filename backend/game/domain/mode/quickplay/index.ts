import { Socket } from "socket.io";
import { applyConfigPatch, createConfig } from "../../../config/configBase";
import RoomService, { RoomServiceRoomState } from "../../../services/roomService";
import PlayerService from "../../../services/playerService";
import startGame from "../../match/startGame";

import type Config from "../../../config/config.types";
import type Room from "../../room";
import type { ConfigPatch } from "../../../config/config.schema";

export default function join(
    socket: Socket,
    { roomService, playerService }: { roomService: RoomService; playerService: PlayerService },
    payload: ConfigPatch = {}
): RoomServiceRoomState | null {
    const config: Config = applyConfigPatch(createConfig('quickplay'), payload);
    const room: Room = roomService.findRoom((existingRoom) => {
        return (
            existingRoom.gameConfig.mode === "quickplay" &&
            existingRoom.status === "lobby" &&
            existingRoom.players.size < 2
        );
    }) ?? roomService.createRoom(config);

    const player = playerService.get(socket.data.identity.id);
    if (!player) return null;

    if (room.status === "playing") {
        roomService.addSpectator(room.id, player);
    } else {
        roomService.addPlayer(room.id, player);
    }

    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = room.status === "playing" ? "spectator" : "player";

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig?.mode}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));

    if (room.players.size === 2) {
        startGame(room, roomService);
    }

    return roomService.getRoomState(room.id);
}

module.exports = {
    join,
};
