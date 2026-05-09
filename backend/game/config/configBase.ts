//# whole room config (with empty objs for gameConfig, matchConfig, etc.)
//# gameConfig (presets + modifiers for game rules, gravity, controls, etc.)
//#? controllersCoinfig (button layout, sensitivity, etc.) - inside gameConfig or separate?
//# matchConfig (rounds, scores, etc.)

import { soloBase } from "../domain/mode/solo/config";
import { leagueBase } from "../domain/mode/league/config";
import { quickplayBase } from "../domain/mode/quickplay/config";
import { customMultiBase } from "../domain/mode/custom/config";

export default function configBase(userType: "anonymous" | "registered") {
    let league = {};
    if (userType === "registered") league = { league: { ...leagueBase } }

    return {
        solo: { ...soloBase },
        quickplay: { ...quickplayBase },
        custom: { ...customMultiBase },
        ...league
    }
}