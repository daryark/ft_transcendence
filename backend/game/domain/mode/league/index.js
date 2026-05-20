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

//# enter mode →
//#   lobby →
//#     ready / config →
//#       start trigger →
//#         game →
//#           end →
//#             back to lobby / exit

export default function join(socket, roomService, payload) {
    const mode = 'league';
roomService.enqueue(socket);

    if (roomService.queue.length >= 2) { //!add matchmacking logic instead IF
        const player1 = roomService.dequeue(socket.id);
        const player2 = roomService.dequeue(socket.id);

        const roomId = `league:${player1.id}:${player2.id}:${Date.now()}`;
        roomService.createRoom(roomId, { mode, players: [player1, player2] });

        player1.join(roomId);
        player2.join(roomId);
        player1.data.roomId = roomId;
        player2.data.roomId = roomId;

        roomService.startGame(roomId);

        return roomService.getRoomState(roomId);
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