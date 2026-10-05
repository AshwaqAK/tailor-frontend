import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  CreatePaymentRequest,
  PaginatedPayments,
  Payment,
  PaymentQuery,
} from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly api = inject(ApiService);

  getByOrder(orderId: string, query: PaymentQuery = {}): Observable<PaginatedPayments> {
    let params = new HttpParams();
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.limit !== undefined) params = params.set('limit', query.limit);
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.paymentMethod) params = params.set('paymentMethod', query.paymentMethod);
    if (query.status) params = params.set('status', query.status);
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortOrder) params = params.set('sortOrder', query.sortOrder);

    return this.api.get<PaginatedPayments>(
      `orders/${encodeURIComponent(orderId)}/payments`,
      params,
    );
  }

  create(request: CreatePaymentRequest): Observable<Payment> {
    return this.api.post<Payment, CreatePaymentRequest>('payments', request);
  }
}
