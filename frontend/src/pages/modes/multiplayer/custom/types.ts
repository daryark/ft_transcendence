import type {
  MatchConfig,
  MultiplayerGameConfig,
  RoomConfig,
} from "../../../../../shared/types/config.types";

export type Visibility = "public" | "private";
export type CustomTab = "welcome" | "room" | "match" | "game";

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
  rank?: string;
  isHost?: boolean;
  matchWins?: number;
  matchTotalGames?: number;
};

export type CustomChatMessage = {
  id: string;
  author: string;
  text: string;
};

export type CustomRoomSnapshot = {
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  visibility?: Visibility;
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
