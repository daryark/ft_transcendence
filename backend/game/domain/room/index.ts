import { Socket } from "socket.io";
import { GameState } from "../engine/state";
import Config from "../../config/config.types.";

export type RoomId = string & { readonly __brand: unique symbol }; // branded type for better type safety

export default interface Room {
    id: RoomId;
    status: "lobby" | "playing";

    players: Socket[];
    spectators?: Socket[];

    state: GameState | null; //createEngine returns state...
    engine?: any; // TODO: function createEngine type;

    config: Config;
}
