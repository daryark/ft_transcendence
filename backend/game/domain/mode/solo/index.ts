const { createConfig } = require('../config/configBase');
const { startGame } = require('../../match/startGame');

import { RoomServiceApi } from "../../../services/roomService";
import type Room from "../../../domain/room";
import { Socket } from "socket.io";
import type Config from "../../../config/config.types.";

const payload = {}: Config | undefined;

function join(
    socket: Socket,
    roomService: RoomServiceApi,
    payload: Partial<Config> = {}
): ReturnType<RoomServiceApi["getRoomState"]> {

    const config: Config = {
        ...createConfig('solo'),
        ...payload
    };

    const room: Room = roomService.createRoom(config);

    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig?.preset}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));

    startGame(room, roomService);

    return roomService.getRoomState(room.id);
};