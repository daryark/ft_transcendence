import { customConfigDTO } from "../domain/mode/custom/configDTO";

export const configDTO = {
    shared: {
        gameConfig: {
            general: {
                boardWidth: 10,
                boardHeight: 20,
            },
            controls: {
                hold: true,
                nextPieces: 5,
                showShadowPiece: true,
            },
        },
    },
    solo: {
        presets: {
            "40lines": {
                label: "40 Lines",
                description: "Clear 40 lines!",
                objective: {
                    winCondition: "lines",
                    linesToClear: 40,
                    key: "time",
                },
            },
            zen: {
                label: "Zen",
                description: "Relax or train endlessly",
                objective: {
                    winCondition: "none",
                    key: "score",
                },
            },
            blitz: {
                label: "Blitz",
                description: "2-minutes blitz",
                objective: {
                    winCondition: "time",
                    timeLimit: 120,
                    key: "score",
                },
            },
        },
        roomRules: {
            anonymousAllowed: true,
            unrankedAllowed: true,
        },
    },
    multiplayer: {
        quickplay: {
            modifiers: [
                "double-hole",
                "no-hold",
                "messier-garbage",
                "faster-gravity",
            ],
            roomRules: {
                anonymousAllowed: true,
                unrankedAllowed: true,
            },
        },
        league: {
            requirements: {
                minimumLevel: 10,
                placementMatches: 10,
            },
            roomRules: {
                anonymousAllowed: false,
                unrankedAllowed: false,
            },
        },
        custom: customConfigDTO,
    },
} as const;