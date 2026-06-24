import { customMultiBase } from "./config";
import type Config from "../../../config/config.types";

export const customConfigDTO = {
    editableConfig: structuredClone(customMultiBase) as Config,
    publicRoomRules: {
        anonymousAllowed: false,
    },
    privateRoomRules: {
        anonymousAllowed: true,
    },
} as const;
