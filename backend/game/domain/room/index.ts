import { GameState } from "../engine/state";
import Config from "../../config/config.types";

export type RoomId = string & { readonly __brand: unique symbol }; // branded type for better type safety

export default interface Room {
    id: RoomId;
    status: "lobby" | "playing";

    players: string[]; // or Player[]
    spectators?: string[]; // or Player[]

    state: GameState | null; //createEngine returns state...
    engine?: any; // TODO: function createEngine type;

    roomConfig: Config["roomConfig"];
    gameConfig: Config["gameConfig"];
    matchConfig?: Config["matchConfig"];
}
