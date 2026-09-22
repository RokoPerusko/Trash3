const TARGET_SPACING_METERS = 300; // roughly matches the built-in ENT -> FER waypoint spacing
const MIN_WAYPOINTS = 3;
const MAX_WAYPOINTS = 20;
const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(atLat) {
  return METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180);
}

// Flat-earth distance in meters - fine at city scale, avoids pulling in a geodesy library
function distanceMeters(a, b) {
  const mLat = METERS_PER_DEG_LAT;
  const mLng = metersPerDegLng((a.lat + b.lat) / 2);
  const dLat = (a.lat - b.lat) * mLat;
  const dLng = (a.lng - b.lng) * mLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Takes the raw points a user dragged out on the map (already starting at the drone's fixed
// origin) and resamples them into evenly arc-length-spaced waypoints, preserving the drawn
// shape rather than just connecting start to end in a straight line.
function subdivideRoute(rawPoints) {
  if (rawPoints.length < 2) {
    throw new Error('A route needs at least two points');
  }

  const cumulative = [0];
  for (let i = 1; i < rawPoints.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceMeters(rawPoints[i - 1], rawPoints[i]));
  }
  const totalLength = cumulative[cumulative.length - 1];

  if (totalLength < 20) {
    throw new Error('Drawn route is too short');
  }

  const numWaypoints = Math.min(
    MAX_WAYPOINTS,
    Math.max(MIN_WAYPOINTS, Math.round(totalLength / TARGET_SPACING_METERS) + 1),
  );

  const waypoints = [];
  for (let i = 0; i < numWaypoints; i++) {
    const targetDist = (i / (numWaypoints - 1)) * totalLength;

    // find the raw segment this target distance falls into
    let segIdx = 0;
    while (segIdx < cumulative.length - 2 && cumulative[segIdx + 1] < targetDist) {
      segIdx++;
    }

    const segStart = rawPoints[segIdx];
    const segEnd = rawPoints[segIdx + 1];
    const segLength = cumulative[segIdx + 1] - cumulative[segIdx];
    const t = segLength > 0 ? (targetDist - cumulative[segIdx]) / segLength : 0;

    waypoints.push({
      lat: segStart.lat + (segEnd.lat - segStart.lat) * t,
      lng: segStart.lng + (segEnd.lng - segStart.lng) * t,
    });
  }

  return waypoints;
}

module.exports = { subdivideRoute };
