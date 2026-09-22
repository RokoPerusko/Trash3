import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Telemetry } from '../../models/types';

const STATUS_LABELS: Record<Telemetry['status'], string> = {
  in_flight: 'In Flight',
  hovering: 'Hovering',
  returning: 'Returning',
};

@Component({
  selector: 'app-telemetry-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './telemetry-panel.component.html',
  styleUrl: './telemetry-panel.component.css',
})
export class TelemetryPanelComponent {
  @Input() telemetry: Telemetry | null = null;

  get statusLabel(): string {
    if (!this.telemetry) return '-';
    return STATUS_LABELS[this.telemetry.status] ?? this.telemetry.status;
  }
}
