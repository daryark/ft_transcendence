import { Socket } from "socket.io";
import { applyConfigPatch, createConfig } from "../../../config/configBase";
import RoomService, { RoomServiceRoomState } from "../../../services/roomService";
import PlayerService from "../../../services/playerService";
import startGame from "../../match/startGame";

import type Room from "../../../domain/room";
import type Config from "../../../config/config.types";
import type { ConfigPatch } from "../../../config/config.schema";
import { emitError } from "../../../../sockets/gameHandlers";

export default function join(
    socket: Socket,
    { roomService, playerService }:
    { roomService: RoomService, playerService: PlayerService },
    payload: ConfigPatch = {}
): RoomServiceRoomState | null {

    const config: Config = applyConfigPatch(createConfig('solo'), payload);

    const room: Room = roomService.createRoom(config);
    const player = playerService.get(socket.data.identity.id)!;
    if (!player) {
        emitError(socket, "PLAYER_NOT_FOUND");
        return null;
    }
    roomService.addPlayer(room.id, player);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig?.mode}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));

    startGame(room, roomService);

    return roomService.getRoomState(room.id);
};