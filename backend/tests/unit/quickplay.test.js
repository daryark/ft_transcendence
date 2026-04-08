const quickplay = require('../../game/modes/quickplay');
const roomManager = require('../../game/rooms/roomManager');

describe('Quickplay', () => {

    beforeEach(() => {
        roomManager.clearRooms();
    });

    test ('#1 same modifiers join same pool', () => {
        const socket1 = { id: 's1', join: jest.fn(), data: {} };
        const socket2 = { id: 's2', join: jest.fn(), data: {} };

        const modifiers = { volatile: true, messy: false };

        const state1 = quickplay.joinQuickplay(socket1, modifiers);
        const state2 = quickplay.joinQuickplay(socket2, modifiers);
        
        expect(state1.id).toBe(state2.id);
        });

    test('#2 different modifiers join different pools', () => {
        const socket1 = { id: 's1', join: jest.fn(), data: {} };
        const socket2 = { id: 's2', join: jest.fn(), data: {} };

        const modifiers1 = { volatile: true, messy: false };
        const modifiers2 = { volatile: false, messy: true };

        const state1 = quickplay.joinQuickplay(socket1, modifiers1);
        const state2 = quickplay.joinQuickplay(socket2, modifiers2);
        
        expect(state1.id).not.toBe(state2.id);
    });

    test('#3 modifiers affect config', () => {
        const socket = { id: 's1', join: jest.fn(), data: {} };

        const state = quickplay.joinQuickplay(socket, { volatile: true });
        
        expect(state.gameConfig.garbage.volatile).toBe(true);
    });
});