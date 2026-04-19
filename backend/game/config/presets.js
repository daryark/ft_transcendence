/* Game Presets */

const DEFAULT = require('./defaultConfig');

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function configBase() {
    return clone(DEFAULT);
}

function applyModifiers(base, modifiers) {
    const config = clone(base);

    if (modifiers?.garbage?.volatile) {
        config.garbage.volatile = true;
    }

    if (modifiers?.garbage?.messy) {
        config.garbage.messiness = 100;
    }

    if (modifiers?.garbage?.sticky) {
        config.gravity.sticky = 1;
    }

    return config;
}

module.exports = {
    configBase,
    applyModifiers
};

// const PRESETS = {

//     quickplay: {
//         roomConfig: {
//         maxPlayers: 30000,
//         allowSpectators: true,
//         allowAnonymous: true
//         },

//         matchConfig: null, // no rounds

//         gameProgression: {
//         floors: true // 100m, 200m etc.
//         }
//     },

//     league: {
//         roomConfig: {
//         maxPlayers: 2,
//         allowSpectators: false,
//         allowAnonymous: false
//         },
//         matchConfig: {
//         rounds: 3
//         },
//         requirements: {
//             minLevel: 10,
//             placementMatches: 10
//         }
//     },
    
//     solo: {
//         roomConfig: {
//         maxPlayers: 1,
//         allowSpectators: false,
//         allowAnonymous: true
//         },
//         matchConfig: null, // no rounds
//         soloMode: '40lines' | 'blitz' | 'zen' | 'custom' // different win conditions
//     },
    
//     custom: {
//         roomConfig: {
//             isPublic: true | false,
//             maxPlayers: 2-100,
//             allowSpectators: true | false,
//             allowAnonymous: true | false
//         },
//         matchConfig: {
//             rounds: 1-10
//         }
//     }
// };

// module.exports = PRESETS;

    // quickplay: {
    //     general: {
    //         bagType: "7-bag",
    //         boardWidth: 10,
    //         boardHeight: 20
    //     },
    //     garbage: {
    //         messiness: 100
    //     },
    //     gravity: {
    //         gravity: 1,
    //         lockDelay: 30
    //     }
    // },
