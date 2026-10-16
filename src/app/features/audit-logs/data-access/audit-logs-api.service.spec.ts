import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '@core/config/app-config';
import {
  AuditActorType,
  AuditLogAction,
  AuditLogEntityType,
  type AuditLog,
  type AuditLogListResponse,
} from '../models/audit-log.model';
import { AuditLogsApiService } from './audit-logs-api.service';

describe('AuditLogsApiService', () => {
  let service: AuditLogsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(AuditLogsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists audit logs with supported filters, pagination, and an unwrapped paginated response', () => {
    let response: AuditLogListResponse | undefined;
    service
      .list({
        cursor: 'opaque-token',
        limit: 100,
        actorId: 'USR-000001',
        action: AuditLogAction.Updated,
        entityType: AuditLogEntityType.Order,
        entityId: 'ORD-000001_item-1',
        fromDate: '2026-01-01',
        toDate: '2026-01-31T23:59:59.999Z',
      })
      .subscribe((value) => (response = value));

    const request = http.expectOne(
      '/api/v1/audit-logs?limit=100&cursor=opaque-token&actorId=USR-000001&action=UPDATED&entityType=ORDER&entityId=ORD-000001_item-1&fromDate=2026-01-01&toDate=2026-01-31T23:59:59.999Z',
    );
    expect(request.request.method).toBe('GET');

    const auditLog = createAuditLog();
    const page: AuditLogListResponse = {
      data: [auditLog],
      meta: { limit: 100, hasNextPage: true, nextCursor: 'next-token' },
    };
    request.flush({ success: true, data: page });

    expect(response).toBe(page);
    expect(response?.data[0]).toBe(auditLog);
  });

  it('omits unset and empty query parameters', () => {
    service
      .list({
        limit: 20,
        actorId: '',
        entityId: ' ',
        fromDate: '',
        toDate: '',
      })
      .subscribe();

    const request = http.expectOne('/api/v1/audit-logs?limit=20');
    expect(request.request.urlWithParams).toBe('/api/v1/audit-logs?limit=20');
    request.flush({
      success: true,
      data: { data: [], meta: { limit: 20, hasNextPage: false, nextCursor: null } },
    });
  });

  it('fetches a detail record using the business audit ID, not MongoDB _id', () => {
    let response: AuditLog | undefined;
    service.getByAuditId('AUD-000123/part').subscribe((value) => (response = value));

    const request = http.expectOne('/api/v1/audit-logs/AUD-000123%2Fpart');
    expect(request.request.method).toBe('GET');

    const auditLog = createAuditLog();
    request.flush({ success: true, data: auditLog });

    expect(response).toBe(auditLog);
  });

  it('preserves optional actor ID and metadata in the typed response', () => {
    const auditLog = createAuditLog({
      actorId: undefined,
      metadata: { status: 'COMPLETED', amount: 1250 },
    });
    let response: AuditLog | undefined;

    service.getByAuditId(auditLog.auditId).subscribe((value) => (response = value));
    const request = http.expectOne(`/api/v1/audit-logs/${auditLog.auditId}`);
    request.flush({ success: true, data: auditLog });

    expect(response?.actorId).toBeUndefined();
    expect(response?.metadata).toEqual({ status: 'COMPLETED', amount: 1250 });
  });

  it('propagates HTTP errors without replacing centralized error handling', () => {
    let error: unknown;
    service.list().subscribe({ error: (value: unknown) => (error = value) });

    const request = http.expectOne('/api/v1/audit-logs');
    request.flush(
      { success: false, message: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(error).toMatchObject({ status: 403 });
  });
});

function createAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    _id: 'mongodb-id',
    auditId: 'AUD-000123',
    actorType: AuditActorType.User,
    actorId: 'USR-000001',
    action: AuditLogAction.Updated,
    entityType: AuditLogEntityType.Order,
    entityId: 'ORD-000001',
    eventAt: '2026-01-15T10:30:00.000Z',
    metadata: { field: 'status' },
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}
