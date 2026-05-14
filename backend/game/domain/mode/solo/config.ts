import type { Config } from "../../../config/config.types.";

export const soloBase: Config = {

    roomConfig: {
        maxPlayers: 1,
        public: false,
        anonymousAllowed: true,
        unrankedAllowed: true
    },

    gameConfig: {
        mode: "solo",

        general: {
            bagType: "7-bag", //* "14-bag", "7+1-bag", "7+2-bag", "7+X-bag", "pairs", "classic", "total_mahyhem"
            boardWidth: 10,
            boardHeight: 20
        },

        controls: {
            hold: true,
            nextPieces: 5,
            showShadowPiece: true
        },

        survival: {
            mode: "none", // "layer", "timer" - garbage has stable layer or comes once in a "time"
            garbageMessiness: 0, // 0 to 1, how messy the garbage is (holes in diff columns)
            stickyLayer: true, // if true, garbage layer will not rase while in a combos cleaning
            minimumLayerHight: 0, //in layer mode
            timerInterval: 300 // in seconds, how often new garbage layer appears in timer mode
        },

        gravity: {
            lockDelay: 30,
            gravity: 0.02, // how fast pieces fall (0-1, where 1 is instant)
            useLeveling: false, //overrides gravity
            gravityIncrease: 0.0007, // how much gravity increases per second/ per level (if useLeveling = true)
            gravitMarginTime: 10000 // how long player has to survive before gravity starts increasing
        },

        //instead of matchConfig - objective to win the game
        objective: {
            winCondition: "score", // "score", "lines", "time", "none" - infinite
            scoreToWin: 1000,
            linesToClear: 0,
            timeLimit: 0, // in seconds
            key: "score", // "time", "lines" - what displayed at the end of the game
            allowRetry: false,
            stock: 2 // amount of extra lives, 0 - infinite IF allowRetry is true. clears field, except garbage

            //displayObjectiveOnBoard: false //if true - shows objective on the backgound of the board
        }
    }
};