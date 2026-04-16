const roomManager = require('../rooms/roomManager');
const { configBase } = require('../config/presets');
const socket = require('../../socket');

function join(player1, player2) {
    const roomId = `league:${player1}:${player2}:${Date.now()}`;

    const room = {
        id: roomId,
        mode: 'league',
        players: [
            roomManager.addPlayer(player1.id),
            roomManager.addPlayer(player2.id)
        ],
        gameConfig: configBase(), //createLeagueConfig() needed or no?
        matchConfig: {
            roundsToWin: roundsToWin(player1, player2),
            scores: {
                [player1.id]: 0,
                [player2.id]: 0
            }
        },
        roomConfig: {
            maxPlayers: 2,
            allowSpectators: false,
            allowAnonymous: false
        }
    };

    roomManager.createRoom(room);
    
    player1.join(roomId);
    player2.join(roomId);
    player1.data.roomId = roomId;
    player2.data.roomId = roomId;

    return roomManager.getRoomState(roomId);
}


// 3 || 5 || 7 based on rank D-A || (S-)-SS || U, X
// (based off the higher of the two player's ranks)
function roundsToWin(player1, player2) {
    const rankOrder = ['D', 'C', 'B', 'A', 'S', 'U', 'X']; //#add + - ranks later
    const higherRank = rankOrder.indexOf(player1.rank) > rankOrder.indexOf(player2.rank) ? player1.rank : player2.rank;

    if (['D', 'C', 'B', 'A'].includes(higherRank)) {
        return 3;
    } else if (['S'].includes(higherRank)) {
        return 5;
    } else {
        return 7;
    }
}


module.exports = {
    join
};