import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  CreateFabricRequest,
  Fabric,
  FabricListResponse,
  FabricQuery,
  UpdateFabricRequest,
} from '../models/fabric.model';

@Injectable({ providedIn: 'root' })
export class FabricsApiService {
  private readonly api = inject(ApiService);

  list(query: FabricQuery): Observable<FabricListResponse> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);
    if (query.name) params = params.set('name', query.name);
    if (query.type) params = params.set('type', query.type);
    if (query.color) params = params.set('color', query.color);
    if (query.unit) params = params.set('unit', query.unit);
    if (query.isActive !== undefined) params = params.set('isActive', query.isActive);
    return this.api.get<FabricListResponse>('fabrics', params);
  }

  getById(fabricId: string): Observable<Fabric> {
    return this.api.get<Fabric>(`fabrics/${encodeURIComponent(fabricId)}`);
  }

  create(request: CreateFabricRequest): Observable<Fabric> {
    return this.api.post<Fabric, CreateFabricRequest>('fabrics', request);
  }

  update(fabricId: string, request: UpdateFabricRequest): Observable<Fabric> {
    return this.api.patch<Fabric, UpdateFabricRequest>(
      `fabrics/${encodeURIComponent(fabricId)}`,
      request,
    );
  }

  remove(fabricId: string): Observable<Fabric> {
    return this.api.delete<Fabric>(`fabrics/${encodeURIComponent(fabricId)}`);
  }
}
