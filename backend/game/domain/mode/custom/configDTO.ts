import { customMultiBase } from "./config";
import type Config from "../../../config/config.types";

export const customConfigDTO = {
    editableConfig: structuredClone(customMultiBase) as Config,
    publicRoomRules: {
        anonymousAllowed: false,
        unrankedAllowed: true,
    },
    privateRoomRules: {
        anonymousAllowed: true,
        unrankedAllowed: true,
    },
} as const;
