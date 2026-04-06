/* Default Game Configuration */

gameConfig = {
  preset: "custom", // or "quickplay"

  general: {
    bagType: "7-bag",
    spins: "ALL-MINI",
    comboMultiplier: true,
    boardWidth: 10,
    boardHeight: 20
  },

  garbage: {
    messiness: 100,
    cap: 0,
    sticky: true,
    doubleHole: false,
    volatile: false
  },

  controls: {
    allow180: true,
    hold: true,
    nextPieces: 5,
    infiniteHold: false
  },

  gravity: {
    gravity: 0.02,
    level: 1,
    speed: 1,
    lockDelay: 30
  }
};