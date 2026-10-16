import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '@core/config/app-config';
import type { ServiceListResponse } from '../models/service.model';
import { ServiceCategory } from '../models/service.model';
import { ServicesApiService } from './services-api.service';

describe('ServicesApiService', () => {
  let service: ServicesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(ServicesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('omits the cursor on the first request and forwards an opaque cursor unchanged', () => {
    service.list({ limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }).subscribe();
    const first = http.expectOne('/api/v1/services?limit=20&sortBy=createdAt&sortOrder=desc');
    first.flush({ success: true, data: page() });

    service
      .list({ cursor: 'opaque/cursor +=', limit: 100, sortBy: 'serviceId', sortOrder: 'asc' })
      .subscribe();
    const next = http.expectOne(
      '/api/v1/services?limit=100&sortBy=serviceId&sortOrder=asc&cursor=opaque/cursor%20%2B=',
    );
    next.flush({ success: true, data: page() });
  });

  it('returns the unwrapped cursor page and propagates errors', () => {
    let response: ServiceListResponse | undefined;
    let error: unknown;
    service.list({ limit: 20, sortBy: 'name', sortOrder: 'asc' }).subscribe({
      next: (value) => (response = value),
      error: (value: unknown) => (error = value),
    });
    const request = http.expectOne('/api/v1/services?limit=20&sortBy=name&sortOrder=asc');
    request.flush(
      { success: false, message: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(response).toBeUndefined();
    expect(error).toMatchObject({ status: 403 });
  });

  it('serializes confirmed filters and CRUD payloads', () => {
    service
      .list({
        limit: 20,
        name: ' Pressing ',
        category: ServiceCategory.Repair,
        isActive: false,
        sortBy: 'price',
        sortOrder: 'asc',
      })
      .subscribe();
    const listRequest = http.expectOne(
      '/api/v1/services?limit=20&sortBy=price&sortOrder=asc&name=Pressing&category=REPAIR&isActive=false',
    );
    listRequest.flush({ success: true, data: page() });

    service.getById('SRV-000001/part').subscribe();
    const detail = http.expectOne('/api/v1/services/SRV-000001%2Fpart');
    detail.flush({ success: true, data: {} });

    const request = {
      name: 'Pressing',
      category: ServiceCategory.Repair,
      price: 125.5,
      description: 'Steam press',
      isActive: true,
    };
    service.create(request).subscribe();
    const create = http.expectOne('/api/v1/services');
    expect(create.request.body).toEqual(request);
    create.flush({ success: true, data: {} });

    service.update('SRV-000001', { isActive: false }).subscribe();
    const update = http.expectOne('/api/v1/services/SRV-000001');
    expect(update.request.body).toEqual({ isActive: false });
    update.flush({ success: true, data: {} });

    service.remove('SRV-000001').subscribe();
    const remove = http.expectOne('/api/v1/services/SRV-000001');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ success: true, data: {} });
  });
});

function page(): ServiceListResponse {
  return { data: [], meta: { limit: 20, hasNextPage: false, nextCursor: null } };
}
