export type BagType =
    | "7-bag"
    | "14-bag"
    | "7+1-bag"
    | "7+2-bag"
    | "7+X-bag"
    | "pairs"
    | "classic"
    | "total_mayhem";


export type QuickplayModifier =
    | "double-hole"
    | "no-hold"
    | "messier-garbage"
    | "faster-gravity";

export type Ranks = "D" | "D+" | "C-" | "C" | "C+" | "B-" | "B" | "B+" | "A-" | "A" | "A+" | "S-" | "S" | "S+" | "SS" | "U" | "X";

export type ObjectiveType = "score" | "lines" | "time" | "none";



export interface Config {
    roomConfig: RoomConfig;
    matchConfig: MatchConfig;
    gameConfig: MultiplayerConfig | SoloConfig;
};

export interface RoomConfig {
    roomName?: string;
    maxPlayers: number;
    public: boolean;
    anonymousAllowed: boolean;
    unrankedAllowed: boolean;
    levelLimit?: number; // for league mode
    rankLimit?: string; // {D, D+, C, C+, B, B+, A, A+} or null for no limit
}

export interface MatchConfig {
    roundsToWin?: number;
    winByRounds?: number; // in seconds, 0 for no limit
    goldenPoint?: number; // in seconds, 0 for no limit
    stock?: number; // amount of extra lives
}

export interface BaseGameConfig {
    general: GameGeneralConfig;
    controls: GameControlsConfig;
    gravity: GameGravityConfig;
}

interface MultiplayerConfig extends BaseGameConfig {
    mode: "quickplay" | "league" | "custom";

    garbage: GameGarbageConfig;

    survival?: never;
    objective?: never;
}

interface SoloConfig extends BaseGameConfig {
    mode: "solo";

    survival: GameSurvivalConfig;
    objective: GameObjectiveConfig;

    garbage?: never;
}

export interface GameGeneralConfig {
    bagType: BagType;
    boardWidth: number; //4-20
    boardHeight: number; //4-40
    modifiers?: QuickplayModifier[]; // for quickplay mode modifiers like "double-hole", "no-hold", "messier-garbage", "faster-gravity"
}

export interface GameControlsConfig {
    hold: boolean;
    nextPieces: number; //0-10
    showShadowPiece: boolean;
}

export interface GameGravityConfig {
    lockDelay: number; // in ms
    gravity: number; // how fast pieces fall (0-1, where 1 is instant)
    useLeveling?: boolean; //overrides gravity
    gravityIncrease: number; // how much gravity increases per second/ per level (if useLeveling = true)
    gravitMarginTime: number; // how long player has to survive before gravity starts increasing, in ms
}

export interface GameGarbageConfig {
    garbageMult: number;
    garbageCap: number; //max amnt of garbage to enter the board at once, the rest will be nullified
    garbageMaxCap: number; //max amnt of garbage pending queue can hold, the rest will be nullified
    garbagePassthrough: boolean; //true - opposing attacks in transit will cancel each other. false - do not cancel.
    allClearGarbage: number; //amnt of lines send on all clear
    garbageDelay: number; //delay before garbage enters the board after being sent, in ms
    garbageDelayOnClear: number; //delay in ms on each clear(per clear, not per line)
}

export interface GameSurvivalConfig {
    mode: "layer" | "timer" | "none"; // "layer", "timer" - garbage has stable layer or comes once in a "time"
    garbageMessiness: number; // 0 to 1, how messy the garbage is (holes in diff columns)
    stickyLayer: boolean; // if true, garbage layer will not rase while in a combos cleaning
    minimumLayerHight: number; //in layer mode
    timerInterval: number; // in seconds, how often new garbage layer appears in timer mode
}

export interface GameObjectiveConfig {
    winCondition: ObjectiveType; // "score", "lines", "time", "none" - infinite
    scoreToWin?: number;
    linesToClear?: number;
    timeLimit?: number; // in seconds
    key: ObjectiveType; // "time", "lines", "score" - what displayed at the end of the game
    allowRetry: boolean;
    stock: number; // amount of extra lives, 0 - infinite IF allowRetry is true. clears field, except garbage
    //displayObjectiveOnBoard: boolean; //if true - shows objective on the backgound of the board
}
