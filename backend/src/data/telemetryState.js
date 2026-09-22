const { ENT } = require('./waypoints');

// Flight hasn't started yet - the drone is hovering at ENT. Position doesn't change,
// only telemetry (battery, signal, temperature...) is lightly simulated.
const state = {
  battery: 95,
  altitude: 0,
  speed: 0,
  position: { lat: ENT.lat, lng: ENT.lng },
  signalStrength: 90,
  status: 'hovering', // in_flight | hovering | returning
  temperature: 24,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function step() {
  state.battery = clamp(state.battery - Math.random() * 0.05, 5, 100);
  state.altitude = clamp(state.altitude + (Math.random() - 0.5) * 0.4, 0, 3);
  state.speed = 0;
  state.signalStrength = clamp(state.signalStrength + (Math.random() - 0.5) * 6, 20, 100);
  state.temperature = clamp(state.temperature + (Math.random() - 0.5) * 0.6, 15, 45);
  state.status = 'hovering';

  return { ...state, timestamp: new Date().toISOString() };
}

function getSnapshot() {
  return { ...state, timestamp: new Date().toISOString() };
}

module.exports = { step, getSnapshot };
