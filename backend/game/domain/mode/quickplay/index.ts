import { Socket } from "socket.io";
import { createConfig } from "../../../config/configBase";
import RoomService, { RoomServiceRoomState } from "../../../services/roomService";
import startGame from "../../match/startGame";

import type Config from "../../../config/config.types";
import type Room from "../../room";
import { RoomId } from "../../room";

export default function join(
    socket: Socket,
    roomService: RoomService,
    payload: Partial<Config> = {}
): RoomServiceRoomState | null {
    //     validateModifiers(payload.gameConfig?.modifiers || {});

    // let room = roomService.getRoom('quickplay' as RoomId); //!modify id and type
    // if (!room) {
        const config: Config = {
            ...createConfig('quickplay'),
            ...payload,
        };
        const room: Room = roomService.createRoom(config);
    // }

    //!auto add as a spectator, always able to press start (after > 1player - auto start) and change from spectator=>player
    //!auto become spectator when finished the game
    //!but in both prev cases => passive spectator! (from lobby seeing players ratings changes and chat)
    //start
    //of the identical part in join(s)
    roomService.addPlayer(room.id, socket.id);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig?.mode}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));
    //end

    if (room.players.length === 2) {
        startGame(room, roomService);
    }

    return roomService.getRoomState(room.id);
}

// function leaveQuickplay(socket) {
//     const roomId = socket.data.roomId;
//     if (!roomId) return;


module.exports = {
    join,
};