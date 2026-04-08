const quickplay = require('../../game/modes/quickplay');

describe('Quickplay', () => {

    test ('#1 same modifiers join same pool', () => {
        const socket1 = { id: 's1', join: jest.fn(), data: {} };
        const socket2 = { id: 's2', join: jest.fn(), data: {} };

        const modifiers = { volatile: true, messy: false };

        const state1 = quickplay.joinQuickplay(socket1, modifiers);
        const state2 = quickplay.joinQuickplay(socket2, modifiers);
        
        expect(state1.id).toBe(state2.id);
        });
});