// src/shared/types/config.types.ts

export type Mode = "solo" | "quickplay" | "custom";

export type SoloPresetName = "zen" | "40Lines" | "blitz";

export interface RoomConfig {
  maxPlayers: number | null;
  public: boolean;
  anonymousAllowed: boolean;
  roomName?: string;
  autoStart?: number;
}

export interface MatchConfig {
  roundsToWin: number;
  winByRounds?: number;
  goldenPoint?: number;
  stock?: number;
}

export interface GeneralConfig {
  bagType: string;
  boardWidth: number;
  boardHeight: number;
  modifiers?: string[];
}

export interface ControlsConfig {
  hold: boolean;
  nextPieces: number;
  showShadowPiece: boolean;
}

export interface GravityConfig {
  lockDelay: number;
  lockDelayDecrease: number;
  minimumLockDelay: number;
  gravity: number;
  useLeveling?: boolean;
  gravityIncrease: number;
  gravitMarginTime: number;
}

export interface GarbageConfig {
  garbageMult: number;
  garbageCap: number;
  garbageMaxCap: number;
  allClearGarbage: number;
  garbageDelay: number;
  garbageDelayOnClear: number;
  garbageTargeting: "payback" | "even" | "random";
  garbageColumnChangeChance: number;
}

export interface SurvivalConfig {
  mode: "layer" | "timer" | "none";
  garbageMessiness: number;
  stickyLayer: boolean;
  minimumLayerHight: number;
  timerInterval: number;
}

export interface ObjectiveConfig {
  winCondition: "score" | "lines" | "time" | "none";
  scoreToWin?: number;
  linesToClear?: number;
  timeLimit?: number;
  key: "score" | "lines" | "time" | "none";
  allowRetry: boolean;
  stock: number;
}

export interface SoloGameConfig {
  mode: "solo";
  preset?: SoloPresetName;
  general: GeneralConfig;
  controls: ControlsConfig;
  survival: SurvivalConfig;
  gravity: GravityConfig;
  objective: ObjectiveConfig;
}

export interface MultiplayerGameConfig {
  mode: "quickplay" | "custom";
  general: GeneralConfig;
  controls: ControlsConfig;
  gravity: GravityConfig;
  garbage: GarbageConfig;
}

export type GameConfig = SoloGameConfig | MultiplayerGameConfig;

export interface SoloPreset {
  roomConfig: RoomConfig;
  gameConfig: SoloGameConfig;
}

export interface MultiplayerPreset {
  roomConfig: RoomConfig;
  matchConfig?: MatchConfig;
  gameConfig: MultiplayerGameConfig;
}

export interface Configs {
  solo: SoloPreset;
  quickplay: MultiplayerPreset;
  custom: MultiplayerPreset;
}
