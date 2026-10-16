import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import type { ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { ApiError } from '@core/api/api-error';

import { AuditLogsApiService } from '../../data-access/audit-logs-api.service';
import {
  AuditActorType,
  AuditLogAction,
  AuditLogEntityType,
  type AuditLogListResponse,
  type AuditLogQuery,
} from '../../models/audit-log.model';
import { AuditLogListComponent } from './audit-log-list.component';

describe('AuditLogListComponent', () => {
  let fixture: ComponentFixture<AuditLogListComponent>;
  let component: AuditLogListComponent;
  let api: { list: (query: AuditLogQuery) => Observable<AuditLogListResponse> };

  beforeEach(async () => {
    api = {
      list: () =>
        of({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuditLogsApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates a read-only list with the backend page size', () => {
    expect(component).toBeTruthy();
    expect(component.meta().limit).toBe(20);
    expect(component.auditLogs()).toEqual([]);
  });

  it('rejects invalid actor, entity, and reversed date filters', () => {
    component.filterForm.setValue({
      actorId: 'USR-123',
      action: AuditLogAction.Updated,
      entityType: AuditLogEntityType.Order,
      entityId: '-invalid',
      fromDate: '2026-02-01',
      toDate: '2026-01-01',
    });

    component.applyFilters();

    expect(component.filterForm.invalid).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('renders system actors and metadata availability without rendering metadata values', () => {
    api.list = () =>
      of({
        data: [
          {
            _id: 'mongo-id',
            auditId: 'AUD-000001',
            actorType: AuditActorType.System,
            action: AuditLogAction.Created,
            entityType: AuditLogEntityType.Customer,
            entityId: 'CUS-000001',
            eventAt: '2026-01-15T10:30:00.000Z',
            metadata: { secret: 'must-not-render' },
            createdAt: '2026-01-15T10:30:00.000Z',
            updatedAt: '2026-01-15T10:30:00.000Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

    component.retry();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('System');
    expect(text).toContain('Available');
    expect(text).not.toContain('must-not-render');
    expect(text).not.toContain('mongo-id');
  });

  it('does not render raw API error messages', () => {
    api.list = () => throwError(() => new ApiError('Sensitive server detail', 500));
    const errorFixture = TestBed.createComponent(AuditLogListComponent);
    errorFixture.detectChanges();

    const text = (errorFixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Audit logs could not be loaded. Please try again.');
    expect(text).not.toContain('Sensitive server detail');
  });
});
