//# whole room config (with empty objs for gameConfig, matchConfig, etc.)
//# gameConfig (presets + modifiers for game rules, gravity, controls, etc.)
//#? controllersCoinfig (button layout, sensitivity, etc.) - inside gameConfig or separate?
//# matchConfig (rounds, scores, etc.)
import { soloBase } from "../domain/mode/solo/config";
import { quickplayBase } from "../domain/mode/quickplay/config";
import { customMultiBase } from "../domain/mode/custom/config";

import type { ConfigPatch } from "./config.schema";
import type Config from "./config.types";
import type { GameMode } from "./gameConfig.types";


const baseConfig = {
    solo: soloBase,
    quickplay: quickplayBase,
    custom: customMultiBase,
} satisfies Record<GameMode, Config>;


// export function configBase(
//     userType: "anonymous" | "registered",
// ) {
//     return {
//         solo: frozenConfigs.solo,
//         quickplay: frozenConfigs.quickplay,
//         custom: frozenConfigs.custom,

//     };
// }


export function createConfig(mode: GameMode): Config {
    return structuredClone(baseConfig[mode]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeConfigValue(baseValue: unknown, patchValue: unknown): unknown {
    if (Array.isArray(patchValue)) {
        return [...patchValue];
    }

    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
        const mergedValue: Record<string, unknown> = { ...baseValue };

        for (const [key, nestedPatchValue] of Object.entries(patchValue)) {
            mergedValue[key] = mergeConfigValue(baseValue[key], nestedPatchValue);
        }

        return mergedValue;
    }

    return patchValue;
}

export function applyConfigPatch(baseConfig: Config, patch: ConfigPatch): Config {
    return mergeConfigValue(baseConfig, patch) as Config;
}
