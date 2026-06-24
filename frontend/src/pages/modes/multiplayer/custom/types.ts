import type {
  MatchConfig,
  MultiplayerGameConfig,
  RoomConfig,
} from "../../../../../shared/types/config.types";

export type Visibility = "public" | "private";
export type CustomTab = "room" | "match" | "game";

export type CustomRoomConfig = RoomConfig & {
  autoStart?: number;
};

export type CustomEditableConfig = {
  roomConfig: CustomRoomConfig;
  matchConfig?: MatchConfig;
  gameConfig: MultiplayerGameConfig;
};

export type CustomRoomPlayer = {
  id: number | string;
  username: string;
  country?: string;
  role?: "player" | "spectator";
  isHost?: boolean;
  matchWins?: number;
  matchTotalGames?: number;
};

export type CustomChatMessage = {
  id: string;
  author: string;
  message?: string;
  text: string;
  actor?: string;
  system?: boolean;
};

export type CustomRoomSnapshot = {
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  visibility?: Visibility;
  status?: "lobby" | "playing" | "ended";
  autoStartEndsAt?: number | null;
  players?: CustomRoomPlayer[];
  config?: CustomEditableConfig;
  chatMessages?: CustomChatMessage[];
};

export type ServerError = {
  reason?: string;
};

export type ConfigPatch = {
  roomConfig?: Partial<RoomConfig>;
  matchConfig?: Partial<MatchConfig>;
  gameConfig?: Partial<MultiplayerGameConfig>;
};
