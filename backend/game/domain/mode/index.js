const quickplay = require('./quickplay');
const league = require('./league');
const custom = require('./custom');
const solo = require('./solo');

const modes = {
  quickplay,
  league,
  custom,
  solo
};

module.exports = modes;