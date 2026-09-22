import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Telemetry } from '../models/types';

const WS_URL = 'ws://localhost:3000/ws/telemetry';
const HTTP_URL = 'http://localhost:3000/api/telemetry';

@Injectable({ providedIn: 'root' })
export class TelemetryService implements OnDestroy {
  private socket: WebSocket | null = null;

  constructor(private http: HttpClient) {}

  getSnapshot(): Observable<Telemetry> {
    return this.http.get<Telemetry>(HTTP_URL);
  }

  connect(onMessage: (data: Telemetry) => void): void {
    this.socket = new WebSocket(WS_URL);
    this.socket.onmessage = (event) => {
      onMessage(JSON.parse(event.data) as Telemetry);
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
