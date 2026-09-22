import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RouteResponse, Waypoint } from '../models/types';

const API_BASE = 'http://localhost:3000/api/route';

@Injectable({ providedIn: 'root' })
export class RouteService {
  constructor(private http: HttpClient) {}

  getRoute(): Observable<RouteResponse> {
    return this.http.get<RouteResponse>(API_BASE);
  }

  generateAlternativeRoute(avoidLocation?: Waypoint): Observable<RouteResponse> {
    return this.http.post<RouteResponse>(`${API_BASE}/alternative`, { avoidLocation });
  }

  resetRoute(): Observable<RouteResponse> {
    return this.http.post<RouteResponse>(`${API_BASE}/reset`, {});
  }

  setCustomRoute(points: { lat: number; lng: number }[]): Observable<RouteResponse> {
    return this.http.post<RouteResponse>(`${API_BASE}/custom`, { points });
  }
}
