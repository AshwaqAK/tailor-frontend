import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type { Order } from '@features/orders/models/order.model';
import type {
  Alteration,
  AlterationListResponse,
  AlterationQuery,
  CreateAlterationRequest,
  UpdateAlterationRequest,
} from '../models/alteration.model';

@Injectable({ providedIn: 'root' })
export class AlterationsApiService {
  private readonly api = inject(ApiService);

  list(query: AlterationQuery = {}): Observable<AlterationListResponse> {
    let params = new HttpParams();
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.limit !== undefined) params = params.set('limit', query.limit);
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.orderId) params = params.set('orderId', query.orderId);
    if (query.status) params = params.set('status', query.status);
    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortOrder) params = params.set('sortOrder', query.sortOrder);

    return this.api.get<AlterationListResponse>('alterations', params);
  }

  getByAlterationId(alterationId: string): Observable<Alteration> {
    return this.api.get<Alteration>(`alterations/${encodeURIComponent(alterationId)}`);
  }

  create(request: CreateAlterationRequest): Observable<Alteration> {
    return this.api.post<Alteration, CreateAlterationRequest>('alterations', request);
  }

  update(alterationId: string, request: UpdateAlterationRequest): Observable<Alteration> {
    return this.api.patch<Alteration, UpdateAlterationRequest>(
      `alterations/${encodeURIComponent(alterationId)}`,
      request,
    );
  }

  createBill(alterationId: string): Observable<Order> {
    return this.api.post<Order, undefined>(
      `alterations/${encodeURIComponent(alterationId)}/bill`,
      undefined,
    );
  }
}
