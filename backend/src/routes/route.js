const express = require('express');
const { ENT } = require('../data/waypoints');
const {
  DETECTION_RADIUS_DEG,
  DANGER_ZONE_RADIUS_DEG,
  getMustAvoidZones,
} = require('../data/simGenerator');
const { subdivideRoute } = require('../data/routeSubdivision');
const routeState = require('../data/routeState');

// A point only reads as "clear" once it's outside the zone's own radius plus the density
// detector's search radius - so this must always stay in sync with that combined trigger distance.
const SAFETY_MARGIN_DEG = 0.0005;
// Extra clearance added on top of the minimum, so a point doesn't sit exactly on the boundary
const CLEARANCE_BUFFER_DEG = 0.0004;

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ route: routeState.getCurrentRoute() });
});

router.get('/alternative', (req, res) => {
  res.json({ route: routeState.getCurrentRoute() });
});

function distance(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function avoidRadiusOf(zone) {
  return DETECTION_RADIUS_DEG + zone.radiusDeg + SAFETY_MARGIN_DEG;
}

// The smallest circle that fully covers two given circles.
function boundingCircle(aCenter, aRadius, bCenter, bRadius) {
  const d = distance(aCenter, bCenter);

  if (d + aRadius <= bRadius) return { center: bCenter, radius: bRadius };
  if (d + bRadius <= aRadius) return { center: aCenter, radius: aRadius };

  const radius = (d + aRadius + bRadius) / 2;
  const t = d > 1e-9 ? (radius - aRadius) / d : 0;
  return {
    center: {
      lat: aCenter.lat + (bCenter.lat - aCenter.lat) * t,
      lng: aCenter.lng + (bCenter.lng - aCenter.lng) * t,
    },
    radius,
  };
}

// When two avoid-zones' no-fly disks overlap, a single point can be pushed clear of one only to
// land inside the other - and back again. Bridging one zone at a time then oscillates between
// the two instead of converging (visible as the drone "circling for no reason", bouncing between
// a handful of nearly-repeated points). Merging every overlapping cluster of zones into one
// combined circle up front means the rest of the routing logic - which is only ever built to
// avoid one obstacle at a time - never actually faces more than one obstacle in the same area.
function mergeOverlappingZones(zones) {
  let merged = zones.map((zone) => ({ lat: zone.lat, lng: zone.lng, radiusDeg: zone.radiusDeg }));

  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i];
        const b = merged[j];
        if (distance(a, b) >= avoidRadiusOf(a) + avoidRadiusOf(b)) continue;

        const bound = boundingCircle(a, avoidRadiusOf(a), b, avoidRadiusOf(b));
        const combined = {
          lat: bound.center.lat,
          lng: bound.center.lng,
          radiusDeg: bound.radius - DETECTION_RADIUS_DEG - SAFETY_MARGIN_DEG,
        };

        merged = merged.filter((_, idx) => idx !== i && idx !== j);
        merged.push(combined);
        changed = true;
        break outer;
      }
    }
  }

  return merged;
}

const MAX_CLEAR_ITERATIONS = 6;

// Repositions a point to sit just outside a single zone's boundary, in the direction away from
// that zone's center.
function pushAwayFrom(point, zone, minDist) {
  const dLat = point.lat - zone.lat;
  const dLng = point.lng - zone.lng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const away = dist > 1e-6 ? { lat: dLat / dist, lng: dLng / dist } : { lat: 0, lng: 1 };
  return { lat: zone.lat + away.lat * minDist, lng: zone.lng + away.lng * minDist };
}

// Moves a point clear of every zone it currently violates. Summing all push vectors into one
// move doesn't work when two zones pull in different (or opposing) directions - the combined
// vector can leave the point still inside one of them. Instead, this repeatedly clears the
// single MOST violated zone (repositioning relative to just that one), then re-checks every
// zone against the new position, until nothing is violated (or the iteration cap is hit).
function clearPoint(point, zones) {
  let current = point;

  for (let i = 0; i < MAX_CLEAR_ITERATIONS; i++) {
    let worstZone = null;
    let worstNeededDist = 0;

    for (const zone of zones) {
      const avoidRadius = avoidRadiusOf(zone);
      const dist = distance(current, zone);
      const neededDist = avoidRadius - dist;
      if (neededDist > worstNeededDist) {
        worstNeededDist = neededDist;
        worstZone = zone;
      }
    }

    if (!worstZone) return current;
    current = pushAwayFrom(current, worstZone, avoidRadiusOf(worstZone) + CLEARANCE_BUFFER_DEG);
  }

  return current;
}

function isClear(point, zones) {
  return zones.every((zone) => distance(point, zone) > avoidRadiusOf(zone));
}

// The closest point on segment a->b to point p (clamped to the segment, not the infinite line)
function closestPointOnSegment(a, b, p) {
  const abLat = b.lat - a.lat;
  const abLng = b.lng - a.lng;
  const lengthSq = abLat * abLat + abLng * abLng;
  const t = lengthSq > 0
    ? Math.max(0, Math.min(1, ((p.lat - a.lat) * abLat + (p.lng - a.lng) * abLng) / lengthSq))
    : 0;
  return { lat: a.lat + abLat * t, lng: a.lng + abLng * t };
}

const MAX_BRIDGE_DEPTH = 6;

// Recursively bridges a straight segment around every zone it actually crosses. Checking only
// the segment's arithmetic midpoint (as a proxy for "does this cross a zone") misses crossings
// that happen off-center - e.g. a long segment (formed after dropping several interior
// waypoints) can clip through a zone near one end while its midpoint stays outside it entirely.
// This instead finds the true closest point on the segment to each zone's center, and - if that
// puts the segment inside the zone - inserts a bypass point there and re-checks both resulting
// halves, so a segment crossing multiple zones in sequence gets a bypass for each one.
function bridgeSegment(a, b, zones, depth = 0) {
  if (depth >= MAX_BRIDGE_DEPTH) return [a, b];

  for (const zone of zones) {
    const closest = closestPointOnSegment(a, b, zone);
    if (distance(closest, zone) <= avoidRadiusOf(zone)) {
      const detour = { ...clearPoint(closest, zones), label: 'Alt-detour' };
      const left = bridgeSegment(a, detour, zones, depth + 1);
      const right = bridgeSegment(detour, b, zones, depth + 1);
      return [...left.slice(0, -1), ...right];
    }
  }

  return [a, b];
}

// Whether the straight line a->b stays clear of every zone along its whole length (not just at
// its endpoints) - used to collapse an over-detoured path back down to the fewest points needed.
function segmentIsClear(a, b, zones) {
  return zones.every((zone) => distance(closestPointOnSegment(a, b, zone), zone) > avoidRadiusOf(zone));
}

// Bridging treats each original waypoint-to-waypoint segment independently, so when the base
// route already has several closely-spaced points near one zone (e.g. a hand-drawn route that
// bends right next to it), each of those short segments gets its own separate bypass point -
// several small, independently-angled detours stacked next to each other instead of one clean
// path around the zone. That's what shows up as the drone "circling for no reason": a fan of
// short zigzag legs where a single smooth detour would do.
//
// This is the standard path-smoothing fix (string-pulling / line-of-sight simplification used in
// navmesh pathfinding): greedily try to connect each point directly to the furthest later point
// it still has a clear line of sight to, dropping every point in between. It never introduces a
// new crossing (every candidate is verified clear with segmentIsClear) and never removes a point
// that's actually needed to get around a zone - it only removes ones that turned out redundant
// once the real bypass points were already in place.
function simplifyRoute(points, zones) {
  if (points.length <= 2) return points;

  const simplified = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let farthest = i + 1;
    for (let j = points.length - 1; j > i + 1; j--) {
      if (segmentIsClear(points[i], points[j], zones)) {
        farthest = j;
        break;
      }
    }
    simplified.push(points[farthest]);
    i = farthest;
  }
  return simplified;
}

// Generates an alternative route that avoids every zone dense enough to itself trigger the
// alert (the flagged anomaly plus any equally busy landmark, e.g. the main station) - not just
// the single zone the alert happened to point at.
router.post('/alternative', (req, res) => {
  const zonesToAvoid = getMustAvoidZones();

  if (req.body?.avoidLocation) {
    zonesToAvoid.unshift({
      lat: req.body.avoidLocation.lat,
      lng: req.body.avoidLocation.lng,
      radiusDeg: req.body?.avoidRadiusDeg ?? DANGER_ZONE_RADIUS_DEG,
    });
  }

  const baseRoute = routeState.getBaseRoute();

  // Merge any avoid-zones whose no-fly disks overlap into one combined obstacle first - see
  // mergeOverlappingZones above for why. Everything below avoids `avoidZones`, not the raw
  // `zonesToAvoid` list; the raw list is still what's reported back for display.
  const avoidZones = mergeOverlappingZones(zonesToAvoid);

  // Step 1: drop any INTERIOR waypoint that sits inside a zone, instead of nudging it in place.
  // A densely-drawn route can have several consecutive waypoints inside the same zone; nudging
  // each one individually (based on its own slightly different angle to the zone center) fans
  // them out of order and makes the line cross itself. Dropping them and bridging the resulting
  // gap with a single bypass point (step 2) keeps the path a simple, non-crossing line. The
  // fixed start/end points are kept and nudged in place rather than dropped.
  const filtered = baseRoute.filter((wp, idx) => {
    const isEndpoint = idx === 0 || idx === baseRoute.length - 1;
    return isEndpoint || isClear(wp, avoidZones);
  });

  const adjusted = filtered.map((wp, idx) => {
    const isEndpoint = idx === 0 || idx === filtered.length - 1;
    if (!isEndpoint || isClear(wp, avoidZones)) return wp;
    const cleared = clearPoint(wp, avoidZones);
    return { ...cleared, label: wp.label ? `${wp.label} (rerouted)` : 'Alt-detour' };
  });

  // Step 2: bridge every segment between (now-kept) waypoints around any zone it actually
  // crosses - whether because points were dropped there, or a zone bulges into an
  // originally-clear segment - using true segment/circle intersection, not just a midpoint check.
  const rerouted = [];
  adjusted.forEach((wp, idx) => {
    const next = adjusted[idx + 1];
    if (!next) return;

    const bridged = bridgeSegment(wp, next, avoidZones);
    rerouted.push(...bridged.slice(0, -1));
  });
  rerouted.push(adjusted[adjusted.length - 1]);

  // Step 3: collapse any now-redundant zigzag left over from bridging each original segment in
  // isolation (see simplifyRoute above) into the fewest waypoints that still avoid every zone.
  const simplified = simplifyRoute(rerouted, avoidZones);

  routeState.setCurrentRoute(simplified);

  res.json({
    route: simplified,
    avoided: zonesToAvoid,
  });
});

router.post('/reset', (req, res) => {
  const route = routeState.resetRoute();
  res.json({ route });
});

// Accepts a freehand-drawn path (raw points the user dragged out on the map) and turns it into
// the new base route: always starts at the drone's fixed origin (ENT), then resamples the
// drawn shape into evenly spaced waypoints.
router.post('/custom', (req, res) => {
  const drawnPoints = req.body?.points;
  if (!Array.isArray(drawnPoints) || drawnPoints.length < 1) {
    return res.status(400).json({ error: 'points must be a non-empty array of {lat, lng}' });
  }

  try {
    const waypoints = subdivideRoute([ENT, ...drawnPoints]);
    const route = waypoints.map((wp, idx) => {
      if (idx === 0) return { ...wp, label: ENT.label };
      if (idx === waypoints.length - 1) return { ...wp, label: 'Destination' };
      return { ...wp, label: `WP${idx}` };
    });

    routeState.setBaseRoute(route);
    res.json({ route });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
