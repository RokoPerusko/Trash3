const express = require('express');
const { getSnapshot } = require('../data/telemetryState');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getSnapshot());
});

module.exports = router;
