import { z } from "zod";

const bagTypeSchema = z.enum([
    "7-bag",
    "14-bag",
    "7+1-bag",
    "7+2-bag",
    "7+X-bag",
    "pairs",
    "classic",
    "total_mayhem",
]);

const quickplayModifierSchema = z.enum([
    "double-hole",
    "no-hold",
    "messier-garbage",
    "faster-gravity",
]);

const objectiveTypeSchema = z.enum(["score", "lines", "time", "none"]);

const rankLimitSchema = z.enum([
    "D",
    "D+",
    "C-",
    "C",
    "C+",
    "B-",
    "B",
    "B+",
    "A-",
    "A",
    "A+",
    "S-",
    "S",
    "S+",
    "SS",
    "U",
    "X",
]);

const roomNameSchema = z.string().trim().min(1);
const positiveIntSchema = z.number().int().min(1);
const nonNegativeIntSchema = z.number().int().min(0);
const nonNegativeNumberSchema = z.number().min(0);
const normalizedGravitySchema = z.number().min(0).max(1);
const maxPlayersSchema = z.union([positiveIntSchema, z.literal(Infinity)]);

const roomConfigPatchSchema = z
    .object({
        roomName: roomNameSchema,
        maxPlayers: maxPlayersSchema,
        public: z.boolean(),
        anonymousAllowed: z.boolean(),
        unrankedAllowed: z.boolean(),
        levelLimit: positiveIntSchema,
        rankLimit: rankLimitSchema,
    })
    .partial()
    .strict();

const matchConfigPatchSchema = z
    .object({
        roundsToWin: positiveIntSchema,
        winByRounds: nonNegativeIntSchema,
        goldenPoint: nonNegativeIntSchema,
        stock: nonNegativeIntSchema,
    })
    .partial()
    .strict();

const gameGeneralPatchSchema = z
    .object({
        bagType: bagTypeSchema,
        boardWidth: z.number().int().min(4).max(20),
        boardHeight: z.number().int().min(4).max(40),
    })
    .partial()
    .strict();

const gameGeneralQuickplayPatchSchema = z
    .object({
        bagType: bagTypeSchema,
        boardWidth: z.number().int().min(4).max(20),
        boardHeight: z.number().int().min(4).max(40),
    })
    .partial()
    .strict();

const gameControlsPatchSchema = z
    .object({
        hold: z.boolean(),
        nextPieces: z.number().int().min(0).max(10),
        showShadowPiece: z.boolean(),
    })
    .partial()
    .strict();

const gameGravityPatchSchema = z
    .object({
        lockDelay: nonNegativeIntSchema,
        gravity: normalizedGravitySchema,
        useLeveling: z.boolean(),
        gravityIncrease: nonNegativeNumberSchema,
        gravitMarginTime: nonNegativeIntSchema,
    })
    .partial()
    .strict();

const gameGarbagePatchSchema = z
    .object({
        garbageMult: nonNegativeNumberSchema,
        garbageCap: nonNegativeIntSchema,
        garbageMaxCap: nonNegativeIntSchema,
        garbagePassthrough: z.boolean(),
        allClearGarbage: nonNegativeIntSchema,
        garbageDelay: nonNegativeIntSchema,
        garbageDelayOnClear: nonNegativeIntSchema,
    })
    .partial()
    .strict()
    .superRefine((value, ctx) => {
        if (
            value.garbageCap !== undefined &&
            value.garbageMaxCap !== undefined &&
            value.garbageMaxCap < value.garbageCap
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["garbageMaxCap"],
                message: "garbageMaxCap must be greater than or equal to garbageCap",
            });
        }
    });

const gameSurvivalPatchSchema = z
    .object({
        mode: z.enum(["layer", "timer", "none"]),
        garbageMessiness: z.number().min(0).max(1),
        stickyLayer: z.boolean(),
        minimumLayerHight: nonNegativeIntSchema,
        timerInterval: nonNegativeIntSchema,
    })
    .partial()
    .strict();

const gameObjectivePatchSchema = z
    .object({
        winCondition: objectiveTypeSchema,
        scoreToWin: nonNegativeIntSchema,
        linesToClear: nonNegativeIntSchema,
        timeLimit: nonNegativeIntSchema,
        key: objectiveTypeSchema,
        allowRetry: z.boolean(),
        stock: nonNegativeIntSchema,
    })
    .partial()
    .strict();

const soloGameConfigPatchSchema = z
    .object({
        mode: z.literal("solo"),
        preset: z.enum(["zen", "40Lines", "blitz"]).optional(),
        general: gameGeneralPatchSchema,
        controls: gameControlsPatchSchema,
        gravity: gameGravityPatchSchema,
        survival: gameSurvivalPatchSchema,
        objective: gameObjectivePatchSchema,
    })
    .partial()
    .strict();

const quickplayGameConfigPatchSchema = z
    .object({
        mode: z.literal("quickplay"),
        modifiers: z.array(quickplayModifierSchema).optional(),
        general: gameGeneralQuickplayPatchSchema,
        controls: gameControlsPatchSchema,
        gravity: gameGravityPatchSchema,
        garbage: gameGarbagePatchSchema,
    })
    .partial()
    .strict();

const multiplayerGameConfigPatchSchema = z
    .object({
        general: gameGeneralPatchSchema,
        controls: gameControlsPatchSchema,
        gravity: gameGravityPatchSchema,
        garbage: gameGarbagePatchSchema,
    })
    .partial()
    .strict();

const leagueGameConfigPatchSchema = multiplayerGameConfigPatchSchema.extend({
    mode: z.literal("league"),
});

const customGameConfigPatchSchema = multiplayerGameConfigPatchSchema.extend({
    mode: z.literal("custom"),
});

const gameConfigPatchWithoutModeSchema = z
    .object({
        general: gameGeneralPatchSchema,
        controls: gameControlsPatchSchema,
        gravity: gameGravityPatchSchema,
    })
    .partial()
    .strict();

const gameConfigPatchSchema = z.union([
    gameConfigPatchWithoutModeSchema,
    soloGameConfigPatchSchema,
    quickplayGameConfigPatchSchema,
    leagueGameConfigPatchSchema,
    customGameConfigPatchSchema,
]);

export const ConfigPatchSchema = z
    .object({
        roomConfig: roomConfigPatchSchema.optional(),
        gameConfig: gameConfigPatchSchema.optional(),
        matchConfig: matchConfigPatchSchema.optional(),
    })
    .strict();

export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;

export {
    customGameConfigPatchSchema,
    gameConfigPatchSchema,
    gameConfigPatchWithoutModeSchema,
    gameControlsPatchSchema,
    gameGarbagePatchSchema,
    gameGeneralPatchSchema,
    gameGeneralQuickplayPatchSchema,
    gameGravityPatchSchema,
    gameObjectivePatchSchema,
    gameSurvivalPatchSchema,
    leagueGameConfigPatchSchema,
    matchConfigPatchSchema,
    multiplayerGameConfigPatchSchema,
    quickplayGameConfigPatchSchema,
    roomConfigPatchSchema,
    soloGameConfigPatchSchema,
};
