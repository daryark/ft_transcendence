const league = require('../../game/domain/mode/league');
const RoomService = require('../../game/services/roomService');

describe('League', () => {
    const roomService = new RoomService();

    beforeEach(() => {
        roomService.clearRooms();
    });
});