import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  OrdersReport,
  OrdersReportQuery,
  CustomersReport,
  CustomersReportQuery,
  AppointmentsReport,
  AppointmentsReportQuery,
  FabricsReport,
  FabricsReportQuery,
  FabricSalesReport,
  FabricSalesReportQuery,
  ServiceUsageReport,
  ServiceUsageReportQuery,
  PaymentsReport,
  PaymentsReportQuery,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly api = inject(ApiService);

  getOrdersReport(query: OrdersReportQuery = {}): Observable<OrdersReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.customerId) params = params.set('customerId', query.customerId);

    return this.api.get<OrdersReport>('reports/orders', params);
  }

  getPaymentsReport(query: PaymentsReportQuery = {}): Observable<PaymentsReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.paymentMethod) params = params.set('paymentMethod', query.paymentMethod);

    return this.api.get<PaymentsReport>('reports/payments', params);
  }

  getCustomersReport(query: CustomersReportQuery = {}): Observable<CustomersReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.limit !== undefined) params = params.set('limit', query.limit);

    return this.api.get<CustomersReport>('reports/customers', params);
  }

  getAppointmentsReport(query: AppointmentsReportQuery = {}): Observable<AppointmentsReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);

    return this.api.get<AppointmentsReport>('reports/appointments', params);
  }

  getFabricsReport(query: FabricsReportQuery = {}): Observable<FabricsReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);

    return this.api.get<FabricsReport>('reports/fabrics', params);
  }

  getFabricSalesReport(query: FabricSalesReportQuery = {}): Observable<FabricSalesReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.fabricId) params = params.set('fabricId', query.fabricId);
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.limit !== undefined) params = params.set('limit', query.limit);

    return this.api.get<FabricSalesReport>('reports/fabric-sales', params);
  }

  getServiceUsageReport(query: ServiceUsageReportQuery = {}): Observable<ServiceUsageReport> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.serviceId) params = params.set('serviceId', query.serviceId);
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.limit !== undefined) params = params.set('limit', query.limit);

    return this.api.get<ServiceUsageReport>('reports/service-usage', params);
  }
}
