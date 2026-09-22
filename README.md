# FakeGIS — Drone over Zagreb (demo)

Demo/prototype application that visualizes a drone flight over Zagreb and detects SIM card
density (IMSI catcher / suspicious activity) along the flight route. It's part of a larger
drone-tracking application.

## Structure

```
FakeGIS/
├── backend/    # Node.js + Express + ws, mock/in-memory data
└── frontend/   # Angular (standalone components) + Leaflet/OpenStreetMap
```

## Running it

### Backend

```bash
cd backend
npm install
npm start          # or: npm run dev (auto-restart on file changes)
```

The backend listens on `http://localhost:3000`.

Endpoints:
- `GET /api/route` — current flight route (ENT → FER waypoints)
- `POST /api/route/alternative` — generates an alternative route that avoids the given (or last
  detected) dense SIM activity zone
- `POST /api/route/reset` — resets to the default ENT → FER route
- `GET /api/sim-density` — mock SIM card generator (random points + an artificial cluster on the
  route) plus density-threshold detection info
- `GET /api/telemetry` — current mock drone telemetry snapshot
- `ws://localhost:3000/ws/telemetry` — WebSocket, live telemetry every ~1.5s

### Frontend

```bash
cd frontend
npm install
npm start           # ng serve, http://localhost:4200
```

Open `http://localhost:4200` in a browser (backend must be running).

## Features

- Leaflet map (OpenStreetMap tiles, no API key needed), initial view fitted to Zagreb
- Drone icon positioned at Ericsson Nikola Tesla (ENT)
- Flight route ENT → destination shown as a line on the map
- **"Show SIM density"** button — displays randomly scattered SIM cards across the city plus an
  artificially dense cluster (near the Ministry of the Interior) that sits directly on the
  drone's route
- Automatic density-threshold detection on the route → alert banner
- **"Generate alternative route"** button — builds a simplified route that avoids the bounding
  box of the detected cluster (waypoint offset, no real routing engine)
- Telemetry panel below the map: battery, altitude, speed, GPS position, signal, flight status,
  temperature — updated live over WebSocket. The flight hasn't started yet, so the drone stays
  parked at ENT while telemetry values fluctuate for demo purposes.

## Note

No real database — all data is mock/in-memory on the backend. The focus is on functionality and
map visualization, not production hardening, authentication, or real drone integration.
