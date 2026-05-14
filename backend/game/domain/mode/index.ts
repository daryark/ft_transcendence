import quickplay from "./quickplay";
import league from "./league";
import custom from "./custom";
import solo from "./solo";

import { GameMode } from "../../config/gameConfig.types";
import { ModeHandler } from "../../services/modeService";

const modes: Record<GameMode, ModeHandler["join"]> = {
  quickplay,
  league,
  solo,
  custom
};

export default modes;