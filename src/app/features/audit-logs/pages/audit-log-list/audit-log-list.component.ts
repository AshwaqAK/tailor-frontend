import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuditLogsApiService } from '../../data-access/audit-logs-api.service';
import {
  AuditLogAction,
  AuditLogEntityType,
  type AuditLog,
  type AuditLogListMeta,
  type AuditLogListResponse,
  type AuditLogQuery,
} from '../../models/audit-log.model';

const PAGE_LIMIT = 20;
const ACTOR_ID_PATTERN = /^USR-\d{6}$/;
const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const EMPTY_META: AuditLogListMeta = {
  limit: PAGE_LIMIT,
  hasNextPage: false,
  nextCursor: null,
};

type LoadResult = { readonly response: AuditLogListResponse } | { readonly error: unknown };

function isValidDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function optionalDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return value === '' || (typeof value === 'string' && isValidDate(value))
    ? null
    : { invalidDate: true };
}

function actorIdValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return value === '' || (typeof value === 'string' && ACTOR_ID_PATTERN.test(value.trim()))
    ? null
    : { invalidActorId: true };
}

function entityIdValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return value === '' || (typeof value === 'string' && ENTITY_ID_PATTERN.test(value.trim()))
    ? null
    : { invalidEntityId: true };
}

function dateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const fromDate = control.get('fromDate')?.value as unknown;
  const toDate = control.get('toDate')?.value as unknown;

  if (
    typeof fromDate !== 'string' ||
    typeof toDate !== 'string' ||
    !isValidDate(fromDate) ||
    !isValidDate(toDate)
  ) {
    return null;
  }

  return fromDate <= toDate ? null : { dateRange: true };
}

@Component({
  selector: 'app-audit-log-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './audit-log-list.component.html',
  styleUrl: './audit-log-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogListComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(AuditLogsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<AuditLogQuery>();
  private cursorHistory: readonly (string | undefined)[] = [undefined];
  private cursorIndex = 0;

  readonly filterForm = this.formBuilder.nonNullable.group(
    {
      actorId: ['', actorIdValidator],
      action: [''],
      entityType: [''],
      entityId: ['', entityIdValidator],
      fromDate: ['', optionalDateValidator],
      toDate: ['', optionalDateValidator],
    },
    { validators: dateRangeValidator },
  );
  readonly auditLogs = signal<readonly AuditLog[]>([]);
  readonly meta = signal<AuditLogListMeta>(EMPTY_META);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actions = Object.values(AuditLogAction);
  readonly entityTypes = Object.values(AuditLogEntityType);
  readonly currentPage = () => this.cursorIndex + 1;

  private lastQuery: AuditLogQuery = { limit: PAGE_LIMIT };

  constructor() {
    this.loadRequests
      .pipe(
        tap((query) => {
          this.lastQuery = query;
          this.loading.set(true);
          this.error.set(null);
          this.auditLogs.set([]);
        }),
        switchMap((query) =>
          this.api.list(query).pipe(
            map((response): LoadResult => ({ response })),
            catchError((error: unknown) => of<LoadResult>({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if ('error' in result) {
          this.error.set(this.errorMessage(result.error));
          this.meta.set(EMPTY_META);
          return;
        }

        this.auditLogs.set(result.response.data);
        this.meta.set(result.response.meta);
      });

    this.load(this.currentQuery());
  }

  applyFilters(): void {
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid) return;

    this.load(this.currentQuery());
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.load(this.currentQuery());
  }

  retry(): void {
    this.loadRequests.next(this.lastQuery);
  }

  nextPage(): void {
    const cursor = this.meta().nextCursor;
    if (this.loading() || !this.meta().hasNextPage || !cursor) return;
    this.cursorHistory = [...this.cursorHistory.slice(0, this.cursorIndex + 1), cursor];
    this.cursorIndex += 1;
    this.load({ ...this.currentQuery(), cursor });
  }

  previousPage(): void {
    if (this.loading() || this.cursorIndex === 0) return;
    this.cursorIndex -= 1;
    this.load({ ...this.currentQuery(), cursor: this.cursorHistory[this.cursorIndex] });
  }

  label(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private load(query: AuditLogQuery): void {
    if (!query.cursor) {
      this.cursorHistory = [undefined];
      this.cursorIndex = 0;
    }
    this.loadRequests.next(query);
  }

  private currentQuery(): AuditLogQuery {
    const { actorId, action, entityType, entityId, fromDate, toDate } =
      this.filterForm.getRawValue();

    return {
      limit: PAGE_LIMIT,
      ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
      ...(action ? { action: action as AuditLogAction } : {}),
      ...(entityType ? { entityType: entityType as AuditLogEntityType } : {}),
      ...(entityId.trim() ? { entityId: entityId.trim() } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    };
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return 'Audit logs could not be loaded. Please try again.';
    }

    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to view audit logs.';
    return 'Audit logs could not be loaded. Please try again.';
  }
}
