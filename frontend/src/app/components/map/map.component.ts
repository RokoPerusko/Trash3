import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { SimZone, Waypoint } from '../../models/types';

// While drawing, only add a new point once the cursor has moved at least this far -
// keeps the drawn path (and the resulting waypoint count) reasonable
const DRAW_MIN_POINT_SPACING_METERS = 15;

// Matches the ZAGREB_BOUNDS used by the backend's SIM density generator,
// so every randomly placed SIM card stays within the initial view.
const ZAGREB_BOUNDS: L.LatLngBoundsExpression = [
  [45.755, 15.86],
  [45.845, 16.03],
];

// Simple top-down quadcopter icon (4 rotors + body) instead of a generic emoji
const DRONE_SVG = `
<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
  <line x1="6" y1="6" x2="14" y2="14" stroke="#0d1117" stroke-width="2"/>
  <line x1="28" y1="6" x2="20" y2="14" stroke="#0d1117" stroke-width="2"/>
  <line x1="6" y1="28" x2="14" y2="20" stroke="#0d1117" stroke-width="2"/>
  <line x1="28" y1="28" x2="20" y2="20" stroke="#0d1117" stroke-width="2"/>
  <circle cx="6" cy="6" r="4.5" fill="#1f6feb" stroke="#0d1117" stroke-width="1.4"/>
  <circle cx="28" cy="6" r="4.5" fill="#1f6feb" stroke="#0d1117" stroke-width="1.4"/>
  <circle cx="6" cy="28" r="4.5" fill="#1f6feb" stroke="#0d1117" stroke-width="1.4"/>
  <circle cx="28" cy="28" r="4.5" fill="#1f6feb" stroke="#0d1117" stroke-width="1.4"/>
  <rect x="12" y="12" width="10" height="10" rx="2.5" fill="#f0f6fc" stroke="#0d1117" stroke-width="1.4"/>
</svg>`;

const droneIcon = L.divIcon({
  className: 'drone-icon',
  html: DRONE_SVG,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() route: Waypoint[] = [];
  @Input() simZones: SimZone[] = [];
  @Input() showSimDensity = false;
  @Input() dronePosition: { lat: number; lng: number } | null = null;
  @Output() routeDrawn = new EventEmitter<{ lat: number; lng: number }[]>();

  private map!: L.Map;
  private routeLayer: L.Polyline | null = null;
  private waypointMarkers: L.LayerGroup = L.layerGroup();
  private simLayer: L.LayerGroup = L.layerGroup();
  private droneMarker: L.Marker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private hasFitInitialBounds = false;

  isDrawMode = false;
  private isDragging = false;
  private drawnLatLngs: L.LatLng[] = [];
  private drawPreviewLayer: L.Polyline | null = null;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.waypointMarkers.addTo(this.map);
    this.simLayer.addTo(this.map);

    // The map container's height changes whenever the alert banner appears/disappears
    // (flex layout). Leaflet doesn't detect that on its own, so without invalidateSize()
    // its pixel<->latlng projection goes stale and markers end up positioned outside the
    // now-shorter visible area. A ResizeObserver keeps it in sync with the real container size.
    this.resizeObserver = new ResizeObserver(() => {
      this.map.invalidateSize();
      if (!this.hasFitInitialBounds) {
        this.map.fitBounds(ZAGREB_BOUNDS);
        this.hasFitInitialBounds = true;
      }
    });
    this.resizeObserver.observe(this.mapContainer.nativeElement);

    this.map.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (this.isDrawMode) this.startDrawing(e.latlng);
    });
    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (this.isDragging) this.continueDrawing(e.latlng);
    });
    this.map.on('mouseup', () => {
      if (this.isDragging) this.finishDrawing();
    });

    this.drawRoute();
    this.drawSimZones();
    this.updateDroneMarker();
  }

  toggleDrawMode(): void {
    this.isDrawMode = !this.isDrawMode;
    if (!this.isDrawMode) {
      this.cancelDrawing();
    }
    this.mapContainer.nativeElement.style.cursor = this.isDrawMode ? 'crosshair' : '';
  }

  private startDrawing(latlng: L.LatLng): void {
    this.isDragging = true;
    this.map.dragging.disable();

    const origin = this.route[0];
    this.drawnLatLngs = origin ? [L.latLng(origin.lat, origin.lng), latlng] : [latlng];
    this.drawPreviewLayer = L.polyline(this.drawnLatLngs, {
      color: '#22c55e',
      weight: 3,
      dashArray: '6 6',
    }).addTo(this.map);
  }

  private continueDrawing(latlng: L.LatLng): void {
    const last = this.drawnLatLngs[this.drawnLatLngs.length - 1];
    if (last.distanceTo(latlng) < DRAW_MIN_POINT_SPACING_METERS) return;

    this.drawnLatLngs.push(latlng);
    this.drawPreviewLayer?.setLatLngs(this.drawnLatLngs);
  }

  private finishDrawing(): void {
    this.isDragging = false;
    this.map.dragging.enable();
    this.drawPreviewLayer?.remove();
    this.drawPreviewLayer = null;

    // The first point is the ENT anchor we prepended just for the preview line -
    // the backend prepends the real ENT itself, so only the drawn points are sent.
    const drawnPoints = this.drawnLatLngs.slice(1).map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    this.drawnLatLngs = [];

    this.isDrawMode = false;
    this.mapContainer.nativeElement.style.cursor = '';

    if (drawnPoints.length >= 1) {
      this.routeDrawn.emit(drawnPoints);
    }
  }

  private cancelDrawing(): void {
    this.isDragging = false;
    this.map.dragging.enable();
    this.drawPreviewLayer?.remove();
    this.drawPreviewLayer = null;
    this.drawnLatLngs = [];
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    if (changes['route']) {
      this.drawRoute();
    }
    if (changes['simZones'] || changes['showSimDensity']) {
      this.drawSimZones();
    }
    if (changes['dronePosition']) {
      this.updateDroneMarker();
    }
  }

  private drawRoute(): void {
    this.routeLayer?.remove();
    this.waypointMarkers.clearLayers();

    if (!this.route.length) return;

    const latLngs = this.route.map((wp): L.LatLngExpression => [wp.lat, wp.lng]);
    this.routeLayer = L.polyline(latLngs, { color: '#3b82f6', weight: 4 }).addTo(this.map);

    this.route.forEach((wp) => {
      L.circleMarker([wp.lat, wp.lng], {
        radius: 5,
        color: '#3b82f6',
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(wp.label ?? '')
        .addTo(this.waypointMarkers);
    });

    // The map intentionally does NOT zoom to the route - it keeps the fixed
    // full-Zagreb view so SIM markers scattered across the city stay visible.
  }

  private drawSimZones(): void {
    this.simLayer.clearLayers();

    if (!this.showSimDensity) return;

    const STYLE: Record<SimZone['type'], { color: string; fillColor: string; fillOpacity: number }> = {
      danger: { color: '#7a0d13', fillColor: '#f85149', fillOpacity: 0.45 },
      landmark: { color: '#7c2d12', fillColor: '#f59e0b', fillOpacity: 0.4 },
      ambient: { color: '#3d1a78', fillColor: '#8957e5', fillOpacity: 0.35 },
    };

    this.simZones.forEach((zone) => {
      const style = STYLE[zone.type];
      // Real-world radius (meters) scaled by card count, so denser zones visibly stand out
      const radiusMeters = 60 + 22 * Math.sqrt(zone.count);

      L.circle([zone.lat, zone.lng], {
        radius: radiusMeters,
        weight: 2,
        ...style,
      })
        .bindTooltip(zone.name ? `${zone.name}: ${zone.count} SIM cards` : `${zone.count} SIM cards`)
        .addTo(this.simLayer);
    });
  }

  private updateDroneMarker(): void {
    if (!this.dronePosition) return;
    const pos: L.LatLngExpression = [this.dronePosition.lat, this.dronePosition.lng];

    if (!this.droneMarker) {
      this.droneMarker = L.marker(pos, { icon: droneIcon }).addTo(this.map);
    } else {
      this.droneMarker.setLatLng(pos);
    }
  }
}
