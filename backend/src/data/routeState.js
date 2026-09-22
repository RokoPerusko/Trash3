const { DEFAULT_ROUTE } = require('./waypoints');

// Shared in-memory state (used by both route.js and simDensity.js so density detection always
// checks the route that's actually being displayed).
//
// baseRoute:    the route as flown with no avoidance detours applied - either the built-in
//               ENT -> FER route, or a custom one the user drew on the map. "Reset route"
//               returns to this, and "Generate alternative route" reroutes FROM this.
// currentRoute: what's actually displayed - baseRoute itself, or an avoidance detour of it.
let baseRoute = DEFAULT_ROUTE;
let currentRoute = DEFAULT_ROUTE;

function getCurrentRoute() {
  return currentRoute;
}

function setCurrentRoute(route) {
  currentRoute = route;
}

function getBaseRoute() {
  return baseRoute;
}

// Sets a new base route (e.g. one the user just drew) and makes it the current route too.
function setBaseRoute(route) {
  baseRoute = route;
  currentRoute = route;
}

function resetRoute() {
  currentRoute = baseRoute;
  return currentRoute;
}

module.exports = { getCurrentRoute, setCurrentRoute, getBaseRoute, setBaseRoute, resetRoute };
