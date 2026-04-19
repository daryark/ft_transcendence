const { configBase } = require('../../config/presets');

//* join →
//*   push player to queue →
//*   try match →
//*     if match found:
//*       create room (hidden)
//*       add both players
//*       lock room (no joins)
//*       socket.join(roomId)
//*     else:
//*       wait in queue

function join(socket, roomService, payload) {
    const queue = [];
    queue.push(socket);

    if (queue.length >= 2) {
        const player1 = queue.shift();
        const player2 = queue.shift();

        return createLeagueRoom(player1, player2, roomService);
    }

    return { status: 'waiting' };

    // const roomId = `league:${player1}:${player2}:${Date.now()}`;

    // const room = {
    //     id: roomId,
    //     mode: 'league',
    //     players: [
    //         roomService.addPlayer(player1.id),
    //         roomService.addPlayer(player2.id)
    //     ],
    //     gameConfig: configBase(), //createLeagueConfig() needed or no?
    //     matchConfig: {
    //         roundsToWin: roundsToWin(player1, player2),
    //         scores: {
    //             [player1.id]: 0,
    //             [player2.id]: 0
    //         }
    //     },
    //     roomConfig: {
    //         maxPlayers: 2,
    //         allowSpectators: false,
    //         allowAnonymous: false
    //     }
    // };

    // roomService.createRoom(room);
    
    // player1.join(roomId);
    // player2.join(roomId);
    // player1.data.roomId = roomId;
    // player2.data.roomId = roomId;

    // return roomService.getRoomState(roomId);
}


// 3 || 5 || 7 based on rank D-A || (S-)-SS || U, X
// (based off the higher of the two player's ranks)
// function roundsToWin(player1, player2) {
//     const rankOrder = ['D', 'C', 'B', 'A', 'S', 'U', 'X']; //#add + - ranks later
//     const higherRank = rankOrder.indexOf(player1.rank) > rankOrder.indexOf(player2.rank) ? player1.rank : player2.rank;

//     if (['D', 'C', 'B', 'A'].includes(higherRank)) {
//         return 3;
//     } else if (['S'].includes(higherRank)) {
//         return 5;
//     } else {
//         return 7;
//     }
// }


module.exports = {
    join
};