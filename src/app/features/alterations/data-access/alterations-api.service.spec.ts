import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '@core/config/app-config';
import type { Order } from '@features/orders/models/order.model';
import {
  AlterationStatus,
  type Alteration,
  type AlterationListResponse,
} from '../models/alteration.model';
import { AlterationsApiService } from './alterations-api.service';

describe('AlterationsApiService', () => {
  let service: AlterationsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(AlterationsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists alterations with supported query parameters and unwraps pagination', () => {
    let response: AlterationListResponse | undefined;
    service
      .list({
        cursor: 'opaque-token',
        limit: 100,
        customerId: 'CUS-000001',
        orderId: 'ORD-000002',
        status: AlterationStatus.InProgress,
        sortBy: 'requestDate',
        sortOrder: 'desc',
      })
      .subscribe((value) => (response = value));

    const request = http.expectOne(
      '/api/v1/alterations?limit=100&cursor=opaque-token&customerId=CUS-000001&orderId=ORD-000002&status=IN_PROGRESS&sortBy=requestDate&sortOrder=desc',
    );
    expect(request.request.method).toBe('GET');

    const page: AlterationListResponse = {
      data: [createAlteration()],
      meta: { limit: 100, hasNextPage: true, nextCursor: 'next-token' },
    };
    request.flush({ success: true, data: page });

    expect(response).toBe(page);
  });

  it('omits unset and empty query parameters', () => {
    service.list({ limit: 20, customerId: '', orderId: ' ', sortBy: undefined }).subscribe();

    const request = http.expectOne('/api/v1/alterations?limit=20');
    request.flush({
      success: true,
      data: { data: [], meta: { limit: 20, hasNextPage: false, nextCursor: null } },
    });
  });

  it('encodes business alteration IDs for detail and update requests', () => {
    service.getByAlterationId('ALT-000123/part').subscribe();
    const getRequest = http.expectOne('/api/v1/alterations/ALT-000123%2Fpart');
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush({ success: true, data: createAlteration() });

    service.update('ALT-000123/part', { status: AlterationStatus.Completed }).subscribe();
    const updateRequest = http.expectOne('/api/v1/alterations/ALT-000123%2Fpart');
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ status: AlterationStatus.Completed });
    updateRequest.flush({
      success: true,
      data: createAlteration({ status: AlterationStatus.Completed }),
    });
  });

  it('sends create and update payloads to the expected endpoints', () => {
    const createRequest = {
      customerId: 'CUS-000001',
      originalOrderId: 'ORD-000002',
      originalOrderItemId: '65f1d7b7c3b7e3d7e3d7e3d7',
      description: 'Shorten sleeve',
      notes: 'Call before collection',
      charge: 250,
    };
    service.create(createRequest).subscribe();
    const request = http.expectOne('/api/v1/alterations');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);
    request.flush({ success: true, data: createAlteration() });
  });

  it('creates a bill without a request body and returns the raw order document', () => {
    let response: Order | undefined;
    service.createBill('ALT-000123/part').subscribe((value) => (response = value));

    const request = http.expectOne('/api/v1/alterations/ALT-000123%2Fpart/bill');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();

    const order = { orderId: 'ORD-000002' } as Order;
    request.flush({ success: true, data: order });
    expect(response).toBe(order);
  });

  it('propagates HTTP errors', () => {
    let error: unknown;
    service.list().subscribe({ error: (value: unknown) => (error = value) });

    const request = http.expectOne('/api/v1/alterations');
    request.flush(
      { success: false, message: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(error).toMatchObject({ status: 403 });
  });
});

function createAlteration(overrides: Partial<Alteration> = {}): Alteration {
  return {
    _id: 'mongodb-id',
    alterationId: 'ALT-000123',
    customerId: 'CUS-000001',
    originalOrderId: 'ORD-000002',
    originalOrderItemId: '65f1d7b7c3b7e3d7e3d7e3d7',
    description: 'Shorten sleeve',
    charge: 250,
    status: AlterationStatus.Requested,
    requestDate: '2026-01-15T10:30:00.000Z',
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}
