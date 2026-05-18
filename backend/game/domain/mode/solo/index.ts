import { Socket } from "socket.io";
import { createConfig } from "../../../config/configBase";
import RoomService, { RoomServiceRoomState } from "../../../services/roomService";
import startGame from "../../match/startGame";

import type Room from "../../../domain/room";
import type Config from "../../../config/config.types";

export default function join(
    socket: Socket,
    roomService: RoomService,
    payload: Partial<Config> = {}
): RoomServiceRoomState | null {

    const config: Config = {
        ...createConfig('solo'),
        ...payload
    };

    const room: Room = roomService.createRoom(config);

    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig?.mode}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));

    startGame(room, roomService);

    return roomService.getRoomState(room.id);
};