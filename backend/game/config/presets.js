/* Game Presets */

const PRESETS = {
    quickplayy: {
        general: {
            bagType: "7-bag",
            boardWidth: 10,
            boardHeight: 20
        },
        garbage: {
            messiness: 100
        },
        gravity: {
            gravity: 0.02,
            lockDelay: 30
        }
    },

    quickplay: {
        roomConfig: {
        maxPlayers: 30000,
        allowSpectators: true,
        allowAnonymous: true
        },

        matchConfig: null, // no rounds

        gameProgression: {
        floors: true // 100m, 200m etc.
        }
    },

    league: {
        roomConfig: {
        maxPlayers: 2,
        allowSpectators: false,
        allowAnonymous: false
        },
        matchConfig: {
        rounds: 3
        },
        requirements: {
            minLevel: 10,
            placementMatches: 10
        }
    },
    
    solo: {
        roomConfig: {
        maxPlayers: 1,
        allowSpectators: false,
        allowAnonymous: true
        },
        matchConfig: null, // no rounds
        soloMode: '40lines' | 'blitz' | 'zen' | 'custom' // different win conditions
    },
    
    custom: {
        roomConfig: {
            isPublic: true | false,
            maxPlayers: 2-100,
            allowSpectators: true | false,
            allowAnonymous: true | false
        },
        matchConfig: {
            rounds: 1-10
        }
    }
};

module.exports = PRESETS;