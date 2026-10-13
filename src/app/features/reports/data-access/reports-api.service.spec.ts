import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '@core/config/app-config';
import { OrderStatus } from '@features/orders/models/order.model';
import { PaymentMethod, PaymentStatus } from '@features/payments/models/payment.model';
import type {
  AppointmentsReport,
  CustomersReport,
  FabricSalesReport,
  FabricsReport,
  OrdersReport,
  PaymentsReport,
  ServiceUsageReport,
} from '../models/report.model';
import { ReportsApiService } from './reports-api.service';

describe('ReportsApiService', () => {
  let service: ReportsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(ReportsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('forwards supported Orders Report query parameters and unwraps the response', () => {
    let response: OrdersReport | undefined;
    service
      .getOrdersReport({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        customerId: 'CUS-000001',
      })
      .subscribe((report) => (response = report));

    const request = http.expectOne(
      '/api/v1/reports/orders?fromDate=2026-01-01&toDate=2026-01-31&customerId=CUS-000001',
    );
    expect(request.request.method).toBe('GET');

    const report = {
      totalOrders: 1,
      ordersByStatus: {
        [OrderStatus.Confirmed]: 1,
      },
    } as unknown as OrdersReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });

  it('does not add unsupported or empty query parameters', () => {
    service.getOrdersReport().subscribe();

    const request = http.expectOne('/api/v1/reports/orders');
    expect(request.request.urlWithParams).toBe('/api/v1/reports/orders');
    request.flush({ success: true, data: {} as OrdersReport });
  });

  it('forwards supported payment report filters and unwraps payment metrics', () => {
    let response: PaymentsReport | undefined;
    service
      .getPaymentsReport({
        fromDate: '2026-02-01',
        toDate: '2026-02-28',
        customerId: 'CUS-000002',
        paymentMethod: PaymentMethod.Upi,
      })
      .subscribe((report) => (response = report));

    const request = http.expectOne(
      '/api/v1/reports/payments?fromDate=2026-02-01&toDate=2026-02-28&customerId=CUS-000002&paymentMethod=UPI',
    );
    expect(request.request.method).toBe('GET');

    const report = {
      grossCollections: 1500,
      refunds: 300,
      netCollections: 1200,
      paymentCounts: {
        byStatus: { [PaymentStatus.Success]: 2 },
        byMethod: { [PaymentMethod.Upi]: 2 },
      },
    } as unknown as PaymentsReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });

  it('forwards customer report pagination and filters using the nested data/meta contract', () => {
    let response: CustomersReport | undefined;
    service
      .getCustomersReport({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        customerId: 'CUS-000003',
        page: 2,
        limit: 100,
      })
      .subscribe((report) => (response = report));

    const request = http.expectOne(
      '/api/v1/reports/customers?fromDate=2026-01-01&toDate=2026-01-31&customerId=CUS-000003&page=2&limit=100',
    );
    expect(request.request.method).toBe('GET');

    const report = {
      registrationCount: 1,
      customerBreakdown: {
        data: [],
        meta: { page: 2, limit: 100, total: 0, totalPages: 0 },
      },
    } as unknown as CustomersReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });

  it('forwards only the supported appointment date filters and unwraps the response', () => {
    let response: AppointmentsReport | undefined;
    service
      .getAppointmentsReport({ fromDate: '2026-04-01', toDate: '2026-04-30' })
      .subscribe((report) => (response = report));

    const request = http.expectOne(
      '/api/v1/reports/appointments?fromDate=2026-04-01&toDate=2026-04-30',
    );
    expect(request.request.method).toBe('GET');

    const report = {
      totalAppointments: 3,
      appointmentsByStatus: { SCHEDULED: 2, COMPLETED: 1 },
      appointmentsByType: { FITTING: 3 },
    } as unknown as AppointmentsReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });

  it('loads the current fabric report without date filters by default', () => {
    let response: FabricsReport | undefined;
    service.getFabricsReport().subscribe((report) => (response = report));

    const request = http.expectOne('/api/v1/reports/fabrics');
    expect(request.request.method).toBe('GET');

    const report = {
      activeFabrics: 2,
      inactiveFabrics: 1,
      availableQuantityByUnit: { METER: 12.5, PIECE: 4 },
    } as unknown as FabricsReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });

  it('forwards fabric sales filters and pagination using the nested breakdown contract', () => {
    let response: FabricSalesReport | undefined;
    service
      .getFabricSalesReport({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        fabricId: 'FAB-000004',
        page: 2,
        limit: 100,
      })
      .subscribe((report) => (response = report));

    const request = http.expectOne(
      '/api/v1/reports/fabric-sales?fromDate=2026-01-01&toDate=2026-01-31&fabricId=FAB-000004&page=2&limit=100',
    );
    expect(request.request.method).toBe('GET');

    const report = {
      saleCount: 1,
      quantitySoldByUnit: { METER: 2.5, PIECE: 0 },
      salesAmount: 1000,
      distinctFabricCount: 1,
      fabricBreakdown: {
        data: [],
        meta: { page: 2, limit: 100, total: 0, totalPages: 0 },
      },
    } as unknown as FabricSalesReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });

  it('forwards service usage filters and pagination using the nested breakdown contract', () => {
    let response: ServiceUsageReport | undefined;
    service
      .getServiceUsageReport({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        serviceId: 'SRV-000005',
        page: 2,
        limit: 100,
      })
      .subscribe((report) => (response = report));

    const request = http.expectOne(
      '/api/v1/reports/service-usage?fromDate=2026-01-01&toDate=2026-01-31&serviceId=SRV-000005&page=2&limit=100',
    );
    expect(request.request.method).toBe('GET');

    const report = {
      serviceLineCount: 1,
      distinctServiceCount: 1,
      serviceAmount: 180,
      serviceBreakdown: {
        data: [],
        meta: { page: 2, limit: 100, total: 0, totalPages: 0 },
      },
    } as unknown as ServiceUsageReport;
    request.flush({ success: true, data: report });

    expect(response).toBe(report);
  });
});
