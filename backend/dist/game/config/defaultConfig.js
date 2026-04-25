"use strict";
/* Default Game Configuration */
//! make default
//# whole room config (with empty objs for gameConfig, matchConfig, etc.)
//# gameConfig (presets + modifiers for game rules, gravity, controls, etc.)
//#? controllersCoinfig (button layout, sensitivity, etc.) - inside gameConfig or separate?
//# matchConfig (rounds, scores, etc.)
const gameConfig = {
    // preset: "custom", // or "quickplay"
    general: {
        bagType: "7-bag",
        spins: "ALL-MINI",
        comboMultiplier: true,
        boardWidth: 10,
        boardHeight: 20,
        hold: true
    },
    garbage: {
        messiness: 0,
        sticky: true,
        volatile: false
        // doubleHole: false
    },
    controls: {
        allow180: true,
        hold: true,
        nextPieces: 5,
    },
    gravity: {
        gravity: 1,
        speed: 1,
        lockDelay: 30
    }
};
module.exports = gameConfig;
