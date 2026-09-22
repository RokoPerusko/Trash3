import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.css',
})
export class AlertBannerComponent {
  @Input() visible = false;
  @Input() maxCount = 0;
  @Input() threshold = 0;
  @Output() generateAlternative = new EventEmitter<void>();
}
