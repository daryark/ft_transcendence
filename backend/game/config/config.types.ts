import { MultiplayerConfig, SoloConfig } from "./gameConfig.types";

export default interface Config {
    roomConfig: RoomConfig;
    gameConfig: MultiplayerConfig | SoloConfig;
    matchConfig?: MatchConfig;
};

interface RoomConfig {
    roomName?: string;
    maxPlayers: number;
    public: boolean;
    anonymousAllowed: boolean;
}

interface MatchConfig {
    roundsToWin?: number;
    winByRounds?: number; // in seconds, 0 for no limit
    goldenPoint?: number; // in seconds, 0 for no limit
    stock?: number; // amount of extra lives
}
