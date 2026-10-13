import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  CreateGarmentTypeRequest,
  GarmentType,
  UpdateGarmentTypeRequest,
} from '../models/garment-type.model';

@Injectable({ providedIn: 'root' })
export class GarmentTypeService {
  private readonly api = inject(ApiService);

  list(): Observable<readonly GarmentType[]> {
    return this.api.get<readonly GarmentType[]>('garment-types');
  }

  getById(garmentTypeId: string): Observable<GarmentType> {
    return this.api.get<GarmentType>(`garment-types/${encodeURIComponent(garmentTypeId)}`);
  }

  create(request: CreateGarmentTypeRequest): Observable<GarmentType> {
    return this.api.post<GarmentType, CreateGarmentTypeRequest>('garment-types', request);
  }

  update(garmentTypeId: string, request: UpdateGarmentTypeRequest): Observable<GarmentType> {
    return this.api.patch<GarmentType, UpdateGarmentTypeRequest>(
      `garment-types/${encodeURIComponent(garmentTypeId)}`,
      request,
    );
  }

  remove(garmentTypeId: string): Observable<GarmentType> {
    return this.api.delete<GarmentType>(`garment-types/${encodeURIComponent(garmentTypeId)}`);
  }
}
