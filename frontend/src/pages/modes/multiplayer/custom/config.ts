import type {
  MatchConfig,
  MultiplayerGameConfig,
  RoomConfig,
} from "../../../../../shared/types/config.types";
import type { GameConfigDTO } from "../../../../socket/gameConfigStorage";
import type {
  ConfigPatch,
  CustomEditableConfig,
} from "./types";

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  roundsToWin: 1,
  winByRounds: 0,
  goldenPoint: 0,
  stock: 0,
};

export const DEFAULT_CUSTOM_CONFIG: CustomEditableConfig = {
  roomConfig: {
    roomName: "",
    public: true,
    maxPlayers: null,
    anonymousAllowed: true,
    autoStart: 0,
  },
  matchConfig: DEFAULT_MATCH_CONFIG,
  gameConfig: {
    mode: "custom",
    general: {
      bagType: "7-bag",
      boardWidth: 10,
      boardHeight: 20,
    },
    controls: {
      hold: true,
      nextPieces: 5,
      showShadowPiece: true,
    },
    gravity: {
      lockDelay: 30,
      lockDelayDecrease: 1,
      minimumLockDelay: 16,
      gravity: 0.02,
      gravityIncrease: 0.001,
      gravitMarginTime: 8000,
    },
    garbage: {
      garbageMult: 1,
      garbageCap: 8,
      garbageMaxCap: 10,
      garbagePassthrough: true,
      allClearGarbage: 5,
      garbageDelay: 500,
      garbageDelayOnClear: 100,
      garbageTargeting: "even",
      garbageColumnChangeChance: 0.35,
    },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toStringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export function readCustomEditableConfig(
  storedConfig: GameConfigDTO | null,
): CustomEditableConfig {
  const editable = storedConfig?.multiplayer.custom.editableConfig;
  if (!isRecord(editable)) return DEFAULT_CUSTOM_CONFIG;

  const sourceRoom = isRecord(editable.roomConfig) ? editable.roomConfig : {};
  const sourceMatch = isRecord(editable.matchConfig) ? editable.matchConfig : {};
  const sourceGame = isRecord(editable.gameConfig) ? editable.gameConfig : {};
  const sourceGeneral = isRecord(sourceGame.general) ? sourceGame.general : {};
  const sourceControls = isRecord(sourceGame.controls) ? sourceGame.controls : {};
  const sourceGravity = isRecord(sourceGame.gravity) ? sourceGame.gravity : {};
  const sourceGarbage = isRecord(sourceGame.garbage) ? sourceGame.garbage : {};

  return {
    roomConfig: {
      ...DEFAULT_CUSTOM_CONFIG.roomConfig,
      roomName: toStringValue(sourceRoom.roomName),
      public: toBoolean(sourceRoom.public, true),
      maxPlayers: finiteOrNull(sourceRoom.maxPlayers),
      anonymousAllowed: toBoolean(sourceRoom.anonymousAllowed, true),
      autoStart: finiteOrNull(sourceRoom.autoStart) ?? 0,
    },
    matchConfig: {
      roundsToWin: toNumber(sourceMatch.roundsToWin, 1),
      winByRounds: toNumber(sourceMatch.winByRounds, 0),
      goldenPoint: toNumber(sourceMatch.goldenPoint, 0),
      stock: toNumber(sourceMatch.stock, 0),
    },
    gameConfig: {
      ...DEFAULT_CUSTOM_CONFIG.gameConfig,
      general: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.general,
        bagType: toStringValue(sourceGeneral.bagType, "7-bag"),
        boardWidth: toNumber(sourceGeneral.boardWidth, 10),
        boardHeight: toNumber(sourceGeneral.boardHeight, 20),
      },
      controls: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.controls,
        hold: toBoolean(sourceControls.hold, true),
        nextPieces: toNumber(sourceControls.nextPieces, 5),
        showShadowPiece: toBoolean(sourceControls.showShadowPiece, true),
      },
      gravity: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.gravity,
        lockDelay: toNumber(sourceGravity.lockDelay, 30),
        lockDelayDecrease: toNumber(sourceGravity.lockDelayDecrease, 1),
        minimumLockDelay: toNumber(sourceGravity.minimumLockDelay, 16),
        gravity: toNumber(sourceGravity.gravity, 0.02),
        gravityIncrease: toNumber(sourceGravity.gravityIncrease, 0.001),
        gravitMarginTime: toNumber(sourceGravity.gravitMarginTime, 8000),
      },
      garbage: {
        ...DEFAULT_CUSTOM_CONFIG.gameConfig.garbage,
        garbageMult: toNumber(sourceGarbage.garbageMult, 1),
        garbageCap: toNumber(sourceGarbage.garbageCap, 8),
        garbageMaxCap: toNumber(sourceGarbage.garbageMaxCap, 10),
        garbagePassthrough: toBoolean(
          sourceGarbage.garbagePassthrough,
          true,
        ),
        allClearGarbage: toNumber(sourceGarbage.allClearGarbage, 5),
        garbageDelay: toNumber(sourceGarbage.garbageDelay, 500),
        garbageDelayOnClear: toNumber(
          sourceGarbage.garbageDelayOnClear,
          100,
        ),
        garbageTargeting:
          sourceGarbage.garbageTargeting === "payback" ||
          sourceGarbage.garbageTargeting === "even" ||
          sourceGarbage.garbageTargeting === "random"
            ? sourceGarbage.garbageTargeting
            : "even",
        garbageColumnChangeChance: toNumber(
          sourceGarbage.garbageColumnChangeChance,
          0.35,
        ),
      },
    },
  };
}

const compactObject = <T extends Record<string, unknown>>(object: T) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

export function createBackendConfigPatch(
  config: CustomEditableConfig,
  roomNameOverride?: string,
): ConfigPatch {
  const roomConfig = compactObject({
    roomName: roomNameOverride ?? config.roomConfig.roomName?.trim() ?? undefined,
    maxPlayers: config.roomConfig.maxPlayers ?? undefined,
    public: config.roomConfig.public,
    anonymousAllowed: config.roomConfig.anonymousAllowed,
  }) as Partial<RoomConfig>;

  return {
    roomConfig,
    matchConfig: config.matchConfig,
    gameConfig: config.gameConfig as Partial<MultiplayerGameConfig>,
  };
}
