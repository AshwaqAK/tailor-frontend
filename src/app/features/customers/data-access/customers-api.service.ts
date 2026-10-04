import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  CreateCustomerRequest,
  Customer,
  CustomerListResponse,
  CustomerQuery,
  UpdateCustomerRequest,
} from '../models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly api = inject(ApiService);

  list(query: CustomerQuery): Observable<CustomerListResponse> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);

    if (query.search) params = params.set('search', query.search);
    if (query.isActive !== undefined) params = params.set('isActive', query.isActive);

    return this.api.get<CustomerListResponse>('customers', params);
  }

  getById(id: string): Observable<Customer> {
    return this.api.get<Customer>(`customers/${encodeURIComponent(id)}`);
  }

  getByCustomerId(customerId: string): Observable<Customer> {
    return this.api.get<Customer>(`customers/by-customer-id/${encodeURIComponent(customerId)}`);
  }

  create(request: CreateCustomerRequest): Observable<Customer> {
    return this.api.post<Customer, CreateCustomerRequest>('customers', request);
  }

  update(id: string, request: UpdateCustomerRequest): Observable<Customer> {
    return this.api.patch<Customer, UpdateCustomerRequest>(
      `customers/${encodeURIComponent(id)}`,
      request,
    );
  }

  deactivate(id: string): Observable<Customer> {
    return this.api.patch<Customer, Record<string, never>>(
      `customers/${encodeURIComponent(id)}/status`,
      {},
    );
  }

  activate(id: string): Observable<Customer> {
    return this.api.patch<Customer, Record<string, never>>(
      `customers/${encodeURIComponent(id)}/activate`,
      {},
    );
  }
}
