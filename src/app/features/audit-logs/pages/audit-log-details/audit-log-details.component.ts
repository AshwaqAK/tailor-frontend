import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuditLogsApiService } from '../../data-access/audit-logs-api.service';
import type { AuditLog } from '../../models/audit-log.model';

const AUDIT_ID_PATTERN = /^AUD-\d{6}$/;

@Component({
  selector: 'app-audit-log-details',
  imports: [DatePipe, RouterLink],
  templateUrl: './audit-log-details.component.html',
  styleUrl: './audit-log-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogDetailsComponent {
  private readonly api = inject(AuditLogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly auditLogId = this.route.snapshot.paramMap.get('auditLogId') ?? '';
  readonly auditLog = signal<AuditLog | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.auditLog.set(null);
    this.error.set(null);

    if (!AUDIT_ID_PATTERN.test(this.auditLogId)) {
      this.loading.set(false);
      this.error.set('The audit log ID is invalid.');
      return;
    }

    this.loading.set(true);
    this.api
      .getByAuditId(this.auditLogId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (auditLog) => this.auditLog.set(auditLog),
        error: (error: unknown) => this.error.set(this.errorMessage(error)),
      });
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  actorLabel(auditLog: AuditLog): string {
    return auditLog.actorId ? `${this.label(auditLog.actorType)} (${auditLog.actorId})` : 'System';
  }

  metadataMessage(auditLog: AuditLog): string {
    return auditLog.metadata
      ? 'Metadata is available but is not displayed because no approved frontend allowlist exists.'
      : 'No metadata was provided.';
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return 'Audit log could not be loaded. Please try again.';
    }

    if (error.status === 404) return 'Audit log not found.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to view this audit log.';
    return 'Audit log could not be loaded. Please try again.';
  }
}
