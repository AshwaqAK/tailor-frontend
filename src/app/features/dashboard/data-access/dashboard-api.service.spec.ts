import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '@core/config/app-config';
import type { DashboardSummary } from '../models/dashboard.model';
import { DashboardApiService } from './dashboard-api.service';

describe('DashboardApiService', () => {
  let service: DashboardApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(DashboardApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the summary through the success envelope and forwards optional ISO dates', () => {
    let response: DashboardSummary | undefined;
    service
      .getSummary({ fromDate: '2026-01-01', toDate: '2026-01-31T23:59:59.000Z' })
      .subscribe((summary) => (response = summary));

    const request = http.expectOne(
      '/api/v1/dashboard/summary?fromDate=2026-01-01&toDate=2026-01-31T23:59:59.000Z',
    );
    expect(request.request.method).toBe('GET');

    const summary = { totalCustomers: 2 } as DashboardSummary;
    request.flush({ success: true, data: summary });

    expect(response).toBe(summary);
  });

  it('does not add query parameters when no date range is provided', () => {
    service.getSummary().subscribe();

    const request = http.expectOne('/api/v1/dashboard/summary');
    expect(request.request.urlWithParams).toBe('/api/v1/dashboard/summary');
    request.flush({ success: true, data: {} as DashboardSummary });
  });
});
