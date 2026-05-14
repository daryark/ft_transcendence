import type { Config } from "../../../config/config.types.";

export const quickplayBase: Config = {

    roomConfig: {
        maxPlayers: Infinity,
        public: true,
        anonymousAllowed: true,
        unrankedAllowed: true
    },

    gameConfig: {

        general: {
            bagType: "7-bag",
            boardWidth: 10,
            boardHeight: 20,
            modifiers: [] //"double-whole", "no-hold", "messier-garbage", "faster-gravity", "double-garbage"
        },

        controls: {
            hold: true,
            nextPieces: 5,
            showShadowPiece: true
        },

        gravity: {
            lockDelay: 30,
            gravity: 0.02, // how fast pieces fall (0-1, where 1 is instant)
            gravityIncrease: 0.0007, // how much gravity increases per second/ per level (if useLeveling = true)
            gravitMarginTime: 10000 // how long player has to survive before gravity starts increasing
        },

        garbage: {
            garbageMult: 1,
            garbageCap: 8, //max amnt of garbage to enter the board at once, the rest will be nullified
            garbageMaxCap: 40, //max amnt of garbage pending queue can hold, the rest will be nullified
            garbagePassthrough: true, //true - opposing attacks in transit will cancel each other. false - do not cancel.
            allClearGarbage: 5, //amnt of lines send on all clear
            garbageDelay: 100, //delay before garbage enters the board after being sent, in ms
            garbageDelayOnClear: 20, //delay in ms on each clear(per clear, not per line)
        }
    }
};