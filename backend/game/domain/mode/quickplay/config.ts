import type Config from "../../../config/config.types";


export const quickplayBase: Config = {

    roomConfig: {
        maxPlayers: Infinity, //define the limit, some big number, or implement queuing system in roomService when limit is reached
        public: true,
        anonymousAllowed: true
    },

    gameConfig: {
        mode: "quickplay",
        modifiers: [], //"double-whole", "no-hold", "messier-garbage", "faster-gravity", "double-garbage"

        general: {
            bagType: "7-bag",
            boardWidth: 10,
            boardHeight: 20,
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
            garbageMaxCap: 40, //max amnt of garbage pending queue can hold, the rest will be nullified
            allClearGarbage: 5, //amnt of lines send on all clear
            garbageDelay: 500, //delay before garbage enters the board after being sent, in ms
            garbageDelayOnClear: 100, //delay in ms on each clear(per clear, not per line)
            garbageTargeting: "random",
            garbageColumnChangeChance: 0.35,
        }
    }
};
