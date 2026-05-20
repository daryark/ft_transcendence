//# whole room config (with empty objs for gameConfig, matchConfig, etc.)
//# gameConfig (presets + modifiers for game rules, gravity, controls, etc.)
//#? controllersCoinfig (button layout, sensitivity, etc.) - inside gameConfig or separate?
//# matchConfig (rounds, scores, etc.)
import { soloBase } from "../domain/mode/solo/config";
import { leagueBase } from "../domain/mode/league/config";
import { quickplayBase } from "../domain/mode/quickplay/config";
import { customMultiBase } from "../domain/mode/custom/config";

import type Config from "./config.types";
import type { GameMode } from "./gameConfig.types";


function deepFreeze<T>(obj: T): T {
    Object.freeze(obj);

    for (const key of Object.keys(obj as object)) {
        const value = (obj as any)[key];

        if (
            value !== null &&
            typeof value === "object" &&
            !Object.isFrozen(value)
        ) {
            deepFreeze(value);
        }
    }

    return obj;
}


const frozenConfigs = {
    solo: deepFreeze(soloBase),
    quickplay: deepFreeze(quickplayBase),
    custom: deepFreeze(customMultiBase),
    league: deepFreeze(leagueBase),
} satisfies Record<GameMode, Config>;


export function configBase(
    userType: "anonymous" | "registered",
) {
    return {
        solo: frozenConfigs.solo,
        quickplay: frozenConfigs.quickplay,
        custom: frozenConfigs.custom,

        ...(userType === "registered" && {
            league: frozenConfigs.league,
        }),
    };
}


export function createConfig(mode: GameMode): Config {
    return structuredClone(frozenConfigs[mode]);
} 