"use strict";
const quickplay = require('./quickplay');
const league = require('./league');
const custom = require('./custom');
const modes = {
    quickplay,
    league,
    custom,
};
module.exports = modes;
