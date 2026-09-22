import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SimDensityResponse } from '../models/types';

const API_BASE = 'http://localhost:3000/api/sim-density';

@Injectable({ providedIn: 'root' })
export class SimDensityService {
  constructor(private http: HttpClient) {}

  getSimDensity(): Observable<SimDensityResponse> {
    return this.http.get<SimDensityResponse>(API_BASE);
  }
}
