import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent } from './components/map/map.component';
import { TelemetryPanelComponent } from './components/telemetry-panel/telemetry-panel.component';
import { AlertBannerComponent } from './components/alert-banner/alert-banner.component';
import { RouteService } from './services/route.service';
import { SimDensityService } from './services/sim-density.service';
import { TelemetryService } from './services/telemetry.service';
import { DensityDetection, SimZone, Telemetry, Waypoint } from './models/types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MapComponent, TelemetryPanelComponent, AlertBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  route: Waypoint[] = [];
  simZones: SimZone[] = [];
  showSimDensity = false;
  detection: DensityDetection | null = null;
  telemetry: Telemetry | null = null;

  constructor(
    private routeService: RouteService,
    private simDensityService: SimDensityService,
    private telemetryService: TelemetryService,
  ) {}

  ngOnInit(): void {
    this.routeService.getRoute().subscribe((res) => {
      this.route = res.route;
      this.refreshDetection();
    });

    this.telemetryService.getSnapshot().subscribe((snapshot) => (this.telemetry = snapshot));
    this.telemetryService.connect((data) => (this.telemetry = data));
  }

  ngOnDestroy(): void {
    this.telemetryService.disconnect();
  }

  toggleSimDensity(): void {
    this.showSimDensity = !this.showSimDensity;
  }

  generateAlternativeRoute(): void {
    const avoidLocation = this.detection?.hotspot ?? undefined;
    this.routeService.generateAlternativeRoute(avoidLocation).subscribe((res) => {
      this.route = res.route;
      this.refreshDetection();
    });
  }

  resetRoute(): void {
    this.routeService.resetRoute().subscribe((res) => {
      this.route = res.route;
      this.refreshDetection();
    });
  }

  onRouteDrawn(points: { lat: number; lng: number }[]): void {
    this.routeService.setCustomRoute(points).subscribe((res) => {
      this.route = res.route;
      this.refreshDetection();
    });
  }

  // Re-checks SIM density against whichever route is now active, so the danger alert shows up
  // the moment a route crosses a dense zone - not only once "Show SIM density" has been toggled
  // on. `showSimDensity` only controls whether the zone circles themselves are drawn on the map;
  // the alert (and the zone data behind it) is kept live regardless.
  private refreshDetection(): void {
    this.simDensityService.getSimDensity().subscribe((res) => {
      this.simZones = res.zones;
      this.detection = res.detection;
    });
  }
}
