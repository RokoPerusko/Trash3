export interface Waypoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteResponse {
  route: Waypoint[];
}

export interface SimZone {
  id: string;
  lat: number;
  lng: number;
  count: number;
  radiusDeg: number;
  type: 'danger' | 'landmark' | 'ambient';
  name?: string;
}

export interface DensityDetection {
  alert: boolean;
  maxCount: number;
  threshold: number;
  hotspot: Waypoint | null;
}

export interface SimDensityResponse {
  zones: SimZone[];
  clusterLocation: Waypoint;
  generatedAt: string;
  detection: DensityDetection;
}

export interface Telemetry {
  battery: number;
  altitude: number;
  speed: number;
  position: { lat: number; lng: number };
  signalStrength: number;
  status: 'in_flight' | 'hovering' | 'returning';
  temperature: number;
  timestamp: string;
}
