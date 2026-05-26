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
    //     validateModifiers(payload.gameConfig?.modifiers || {});

    // let room = roomService.getRoom('quickplay' as RoomId); //!modify id and type
    // if (!room) {
    const config: Config = applyConfigPatch(createConfig('quickplay'), payload);
    const room: Room = roomService.createRoom(config);
    // }

    //!auto add as a spectator, always able to press start (after > 1player - auto start) and change from spectator=>player
    //!auto become spectator when finished the game
    //!but in both prev cases => passive spectator! (from lobby seeing players ratings changes and chat)
    //start
    //of the identical part in join(s)
    const player = playerService.get(socket.data.identity.id);
    if (!player) return null;

    roomService.addPlayer(room.id, player);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.role = 'player';

    console.log(`Socket ${socket.id} joined room ${room.id} as player. Game type: ${room.gameConfig?.mode}`);
    console.log('ROOM STATE:', roomService.getRoom(room.id));
    //end

    if (room.players.size === 2) {
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
