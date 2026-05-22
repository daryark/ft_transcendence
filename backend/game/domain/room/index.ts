import { GameState } from "../engine/state";
import Config from "../../config/config.types";
import Player from "../player";
import { UserId } from "../../../auth/identity";
import { Engine } from "../engine/tetrisEngline";

export type RoomId = string & { readonly __brand: unique symbol }; // branded type for better type safety

export default interface Room {
    id: RoomId;
    status: "lobby" | "playing" | "ended";

    players: Map<UserId, Player>;
    spectators?: Map<UserId, Player>;

    state: GameState | null; //createEngine returns state
    engine: Engine | null; 

    roomConfig: Config["roomConfig"];
    gameConfig: Config["gameConfig"];
    matchConfig?: Config["matchConfig"];
}
