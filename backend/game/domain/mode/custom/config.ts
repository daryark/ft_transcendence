import type Config from "../../../config/config.types";

export const customMultiBase: Config = {

    roomConfig: {
        roomName: "Default Room",
        public: true,
        maxPlayers: Infinity,
        anonymousAllowed: true,
        autoStart: 0,
    },

    matchConfig: {
        roundsToWin: 1,
        winByRounds: 0, // in seconds, 0 for no limit
        goldenPoint: 0, // 0 for no limit
        stock: 0 // amount of extra lives
    },

    gameConfig: {
        mode: "custom",

        general: {
            bagType: "7-bag",
            boardWidth: 10,
            boardHeight: 20
        },

        controls: {
            hold: true,
            nextPieces: 5,
            showShadowPiece: true
        },

        gravity: {
            lockDelay: 30,
            lockDelayDecrease: 1,
            minimumLockDelay: 16,
            gravity: 0.02, // how fast pieces fall (0-1, where 1 is instant)
            gravityIncrease: 0.001, // how much gravity increases per second/ per level (if useLeveling = true)
            gravitMarginTime: 8000 // how long player has to survive before gravity starts increasing
        },

        garbage: {
            garbageMult: 1,
            garbageCap: 8, //max amnt of garbage to enter the board at once, the rest will be nullified
            garbageMaxCap: 10, //max amnt of garbage pending queue can hold, the rest will be nullified
            allClearGarbage: 5, //amnt of lines send on all clear
            garbageDelay: 500, //delay before garbage enters the board after being sent, in ms
            garbageDelayOnClear: 100, //delay in ms on each clear(per clear, not per line)
            garbageTargeting: "even",
            garbageColumnChangeChance: 0.35,
        }
    }
};
