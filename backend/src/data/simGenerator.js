const { CLUSTER_LOCATION } = require('./waypoints');

// Zagreb bounding box (approximate)
const ZAGREB_BOUNDS = {
  minLat: 45.755,
  maxLat: 45.845,
  minLng: 15.86,
  maxLng: 16.03,
};

// Instead of thousands of individual SIM card markers, the map shows aggregated "zones" -
// each one a count of SIM cards detected in that area. Cleaner to read, and much cheaper
// to render than one marker per card.

const DANGER_ZONE_COUNT = 250; // unmistakable anomaly sitting directly on the drone route
const DANGER_ZONE_RADIUS_DEG = 0.002; // ~220m

const DENSITY_THRESHOLD = 150; // SIM cards within DETECTION_RADIUS_DEG of the route
const DETECTION_RADIUS_DEG = 0.003; // ~300m

// Named landmark zones (squares, hospitals, transit hubs...). Counts follow a simple rule of
// thumb: the busier/larger the place and the more foot traffic it normally sees, the more
// phones (and therefore SIM cards) are there at any given moment - main square and the main
// train station top the list, hospitals (large, staffed 24/7) are next, parks are lowest.
const LANDMARK_ZONES = [
  { name: 'Zagreb Main Station', lat: 45.8036, lng: 15.9773, count: 210 },
  { name: 'Ban Jelačić Square', lat: 45.8131, lng: 15.9775, count: 195 },
  { name: 'Avenue Mall', lat: 45.7857, lng: 16.0027, count: 165 },
  { name: 'KBC Zagreb (Rebro)', lat: 45.8047, lng: 15.9978, count: 155 },
  { name: 'Merkur Hospital', lat: 45.8188, lng: 15.9975, count: 95 },
  { name: 'Kvatrić Square', lat: 45.8107, lng: 15.9917, count: 80 },
  { name: 'Maksimir Park', lat: 45.8228, lng: 16.0086, count: 65 },
  { name: 'Bundek', lat: 45.7807, lng: 15.9805, count: 55 },
];
const LANDMARK_ZONE_RADIUS_DEG = 0.0012; // ~130m

// A larger number of smaller, ambient zones scattered across the whole city - "here and
// there" pockets of activity, nowhere near the route.
const AMBIENT_ZONE_COUNT = 30;
const AMBIENT_ZONE_RADIUS_DEG = 0.001; // ~110m
const AMBIENT_ZONE_MIN_COUNT = 15;
const AMBIENT_ZONE_MAX_COUNT = 60;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function generateAmbientZones(count) {
  const zones = [];
  for (let i = 0; i < count; i++) {
    zones.push({
      id: `zone-ambient-${i}`,
      lat: randomBetween(ZAGREB_BOUNDS.minLat, ZAGREB_BOUNDS.maxLat),
      lng: randomBetween(ZAGREB_BOUNDS.minLng, ZAGREB_BOUNDS.maxLng),
      count: Math.round(randomBetween(AMBIENT_ZONE_MIN_COUNT, AMBIENT_ZONE_MAX_COUNT)),
      radiusDeg: AMBIENT_ZONE_RADIUS_DEG,
      type: 'ambient',
    });
  }
  return zones;
}

function generateSimDensityData() {
  const dangerZone = {
    id: 'zone-danger',
    lat: CLUSTER_LOCATION.lat,
    lng: CLUSTER_LOCATION.lng,
    count: DANGER_ZONE_COUNT,
    radiusDeg: DANGER_ZONE_RADIUS_DEG,
    type: 'danger',
  };

  const landmarkZones = LANDMARK_ZONES.map((zone, idx) => ({
    id: `zone-landmark-${idx}`,
    lat: zone.lat,
    lng: zone.lng,
    count: zone.count,
    radiusDeg: LANDMARK_ZONE_RADIUS_DEG,
    type: 'landmark',
    name: zone.name,
  }));

  const ambientZones = generateAmbientZones(AMBIENT_ZONE_COUNT);

  return {
    zones: [dangerZone, ...landmarkZones, ...ambientZones],
    clusterLocation: CLUSTER_LOCATION,
    generatedAt: new Date().toISOString(),
  };
}

function distanceDeg(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Checks SIM card density along the given route (list of waypoints). Uses the single densest
// nearby zone per waypoint (not a sum of overlapping zones), so the alert reflects "you're
// flying through one dense zone", not incidental proximity to several small/moderate ones.
function detectDensityOnRoute(route, zones) {
  let maxCount = 0;
  let hotspot = null;

  for (const wp of route) {
    const nearbyZones = zones.filter((zone) => distanceDeg(wp, zone) <= DETECTION_RADIUS_DEG + zone.radiusDeg);
    const densest = nearbyZones.reduce((max, zone) => Math.max(max, zone.count), 0);

    if (densest > maxCount) {
      maxCount = densest;
      hotspot = wp;
    }
  }

  return {
    alert: maxCount >= DENSITY_THRESHOLD,
    maxCount,
    threshold: DENSITY_THRESHOLD,
    hotspot,
  };
}

// Static (non-random) zones dense enough to trigger the alert on their own - the danger zone
// plus any landmark whose count is at/above the threshold. Route planning avoids all of them,
// not just the one zone the alert happened to flag, so a reroute never clips through another
// equally dense zone (e.g. the main train station) on its way around the first one.
function getMustAvoidZones() {
  const dangerZone = {
    lat: CLUSTER_LOCATION.lat,
    lng: CLUSTER_LOCATION.lng,
    radiusDeg: DANGER_ZONE_RADIUS_DEG,
  };

  const denseLandmarks = LANDMARK_ZONES.filter((zone) => zone.count >= DENSITY_THRESHOLD).map((zone) => ({
    lat: zone.lat,
    lng: zone.lng,
    radiusDeg: LANDMARK_ZONE_RADIUS_DEG,
  }));

  return [dangerZone, ...denseLandmarks];
}

module.exports = {
  generateSimDensityData,
  detectDensityOnRoute,
  getMustAvoidZones,
  DENSITY_THRESHOLD,
  DETECTION_RADIUS_DEG,
  DANGER_ZONE_RADIUS_DEG,
};
