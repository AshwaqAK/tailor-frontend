import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  CreateMeasurementRequest,
  Measurement,
  UpdateMeasurementRequest,
} from '../models/measurement.model';

@Injectable({ providedIn: 'root' })
export class MeasurementsApiService {
  private readonly api = inject(ApiService);

  getByCustomer(customerId: string): Observable<readonly Measurement[]> {
    return this.api.get<readonly Measurement[]>(
      `measurements/customer/${encodeURIComponent(customerId)}`,
    );
  }

  create(request: CreateMeasurementRequest): Observable<Measurement> {
    return this.api.post<Measurement, CreateMeasurementRequest>('measurements', request);
  }

  update(id: string, request: UpdateMeasurementRequest): Observable<Measurement> {
    return this.api.patch<Measurement, UpdateMeasurementRequest>(
      `measurements/${encodeURIComponent(id)}`,
      request,
    );
  }
}
