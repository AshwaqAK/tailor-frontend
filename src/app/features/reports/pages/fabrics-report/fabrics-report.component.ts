import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { QuantityUnit } from '@features/fabrics/models/fabric.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import type { FabricsReport, FabricsReportQuery } from '../../models/report.model';

@Component({
  selector: 'app-fabrics-report',
  imports: [],
  templateUrl: './fabrics-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabricsReportComponent {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadRequests = new Subject<FabricsReportQuery>();

  readonly report = signal<FabricsReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly quantityUnits = [QuantityUnit.Meter, QuantityUnit.Piece] as const;

  constructor() {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.report.set(null);
        }),
        switchMap((query) =>
          this.reportsApi.getFabricsReport(query).pipe(
            map((report) => ({ report })),
            catchError((error: unknown) => of({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if ('error' in result) {
          this.error.set(
            result.error instanceof ApiError
              ? result.error.message
              : 'Fabrics report could not be loaded. Please try again.',
          );
          return;
        }

        this.report.set(result.report);
      });

    // No date filters are sent: this endpoint's unfiltered result is the current catalog stock summary.
    this.loadReport({});
  }

  retry(): void {
    this.loadReport({});
  }

  quantity(unit: QuantityUnit): number {
    return this.report()?.availableQuantityByUnit?.[unit] ?? 0;
  }

  unitLabel(unit: QuantityUnit): string {
    return unit === QuantityUnit.Meter ? 'Meters' : 'Pieces';
  }

  hasInventory(): boolean {
    return (this.report()?.totalFabrics ?? 0) > 0;
  }

  private loadReport(query: FabricsReportQuery): void {
    this.loadRequests.next(query);
  }
}
