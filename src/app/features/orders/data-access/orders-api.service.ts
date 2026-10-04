import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import type {
  CreateOrderRequest,
  CursorPaginatedOrders,
  Order,
  OrderStatus,
  OrderWithItems,
} from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly api = inject(ApiService);
  getAll(cursor?: string, limit = 20): Observable<CursorPaginatedOrders> {
    let params = new HttpParams().set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    return this.api.get('orders', params);
  }
  getByCustomer(customerId: string): Observable<readonly OrderWithItems[]> {
    return this.api.get(`orders/customer/${encodeURIComponent(customerId)}`);
  }
  getByOrderId(orderId: string): Observable<OrderWithItems> {
    return this.api.get(`orders/${encodeURIComponent(orderId)}`);
  }
  create(request: CreateOrderRequest): Observable<{
    readonly order: Order;
    readonly items: readonly OrderWithItems['items'][number][];
  }> {
    return this.api.post('orders', request);
  }
  updateStatus(orderId: string, status: OrderStatus): Observable<Order> {
    return this.api.patch(`orders/${encodeURIComponent(orderId)}/status`, { status });
  }
}
