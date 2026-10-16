import '@angular/compiler';

import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@core/api/api-error';
import { AuditLogsApiService } from '../../data-access/audit-logs-api.service';
import {
  AuditActorType,
  AuditLogAction,
  AuditLogEntityType,
  type AuditLog,
} from '../../models/audit-log.model';
import { AuditLogDetailsComponent } from './audit-log-details.component';

describe('AuditLogDetailsComponent', () => {
  let auditLogId: string;
  let getByAuditId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auditLogId = 'AUD-000001';
    getByAuditId = vi.fn(() => of(createAuditLog()));

    TestBed.configureTestingModule({
      imports: [AuditLogDetailsComponent],
      providers: [
        {
          provide: AuditLogsApiService,
          useValue: { getByAuditId },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => auditLogId } } },
        },
      ],
    });
  });

  it('loads the business audit ID and renders event details without raw metadata', () => {
    const fixture = TestBed.createComponent(AuditLogDetailsComponent);
    fixture.detectChanges();

    expect(getByAuditId).toHaveBeenCalledWith('AUD-000001');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('AUD-000001');
    expect(text).toContain('System');
    expect(text).toContain('Metadata is available but is not displayed');
    expect(text).not.toContain('token-value');
    expect(text).not.toContain('mongo-id');
  });

  it('does not call the API for a malformed audit ID', () => {
    auditLogId = 'not-an-audit-id';
    const fixture = TestBed.createComponent(AuditLogDetailsComponent);
    fixture.detectChanges();

    expect(getByAuditId).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The audit log ID is invalid.',
    );
  });

  it('maps a not-found API response to a safe not-found message', () => {
    getByAuditId.mockReturnValue(throwError(() => new ApiError('Raw server detail', 404)));
    const fixture = TestBed.createComponent(AuditLogDetailsComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Audit log not found.');
    expect(text).not.toContain('Raw server detail');
  });

  it('maps API failures to a retryable generic message', () => {
    getByAuditId.mockReturnValue(throwError(() => new ApiError('Sensitive server detail', 500)));
    const fixture = TestBed.createComponent(AuditLogDetailsComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Audit log could not be loaded. Please try again.');
    expect(text).not.toContain('Sensitive server detail');
  });

  it('maps forbidden responses to a safe authorization message', () => {
    getByAuditId.mockReturnValue(throwError(() => new ApiError('Forbidden detail', 403)));
    const fixture = TestBed.createComponent(AuditLogDetailsComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('You do not have permission to view this audit log.');
    expect(text).not.toContain('Forbidden detail');
  });
});

function createAuditLog(): AuditLog {
  return {
    _id: 'mongo-id',
    auditId: 'AUD-000001',
    actorType: AuditActorType.System,
    action: AuditLogAction.Updated,
    entityType: AuditLogEntityType.Order,
    entityId: 'ORD-000001',
    eventAt: '2026-01-15T10:30:00.000Z',
    metadata: { token: 'token-value' },
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
  };
}
