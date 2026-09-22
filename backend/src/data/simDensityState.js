const { generateSimDensityData } = require('./simGenerator');

// SIM density zones are generated once (lazily, on first request) and then kept stable for the
// life of the server. Route changes (reset / alternative) must never shuffle the zones -
// only the route itself changes; the zones are the "ground truth" the route is checked against.
let cachedData = null;

function getSimDensityData() {
  if (!cachedData) {
    cachedData = generateSimDensityData();
  }
  return cachedData;
}

module.exports = { getSimDensityData };
