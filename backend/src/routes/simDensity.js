const express = require('express');
const { detectDensityOnRoute } = require('../data/simGenerator');
const { getSimDensityData } = require('../data/simDensityState');
const routeState = require('../data/routeState');

const router = express.Router();

router.get('/', (req, res) => {
  const data = getSimDensityData();
  const detection = detectDensityOnRoute(routeState.getCurrentRoute(), data.zones);

  res.json({
    ...data,
    detection,
  });
});

module.exports = router;
