import { MultiplayerConfig, SoloConfig } from "./gameConfig.types";

export type Ranks = "D" | "D+" | "C-" | "C" | "C+" | "B-" | "B" | "B+" | "A-" | "A" | "A+" | "S-" | "S" | "S+" | "SS" | "U" | "X";

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
    unrankedAllowed: boolean;
    levelLimit?: number; // for league mode
    rankLimit?: string; // {D, D+, C, C+, B, B+, A, A+} or null for no limit
}

interface MatchConfig {
    roundsToWin?: number;
    winByRounds?: number; // in seconds, 0 for no limit
    goldenPoint?: number; // in seconds, 0 for no limit
    stock?: number; // amount of extra lives
}

