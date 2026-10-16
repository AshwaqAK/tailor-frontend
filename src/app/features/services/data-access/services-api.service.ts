import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  CreateServiceRequest,
  Service,
  ServiceListResponse,
  ServiceQuery,
  UpdateServiceRequest,
} from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  private readonly api = inject(ApiService);

  list(query: ServiceQuery): Observable<ServiceListResponse> {
    let params = new HttpParams()
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);

    if (query.cursor) params = params.set('cursor', query.cursor);
    if (query.name?.trim()) params = params.set('name', query.name.trim());
    if (query.category) params = params.set('category', query.category);
    if (query.isActive !== undefined) params = params.set('isActive', query.isActive);

    return this.api.get<ServiceListResponse>('services', params);
  }

  getById(serviceId: string): Observable<Service> {
    return this.api.get<Service>(`services/${encodeURIComponent(serviceId)}`);
  }

  create(request: CreateServiceRequest): Observable<Service> {
    return this.api.post<Service, CreateServiceRequest>('services', request);
  }

  update(serviceId: string, request: UpdateServiceRequest): Observable<Service> {
    return this.api.patch<Service, UpdateServiceRequest>(
      `services/${encodeURIComponent(serviceId)}`,
      request,
    );
  }

  remove(serviceId: string): Observable<Service> {
    return this.api.delete<Service>(`services/${encodeURIComponent(serviceId)}`);
  }
}
