import quickplay from "./quickplay";
import league from "./league";
import custom from "./custom";
import solo from "./solo";

import { GameMode } from "../../config/gameConfig.types";
import { ModeJoinHandler } from "../../services/modeService";

const modes: Record<GameMode, ModeJoinHandler> = {
  quickplay,
  league,
  solo,
  custom
};

export default modes;