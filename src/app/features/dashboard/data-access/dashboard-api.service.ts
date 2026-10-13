import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type { DashboardSummary, DashboardSummaryQuery } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  getSummary(query: DashboardSummaryQuery = {}): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);

    return this.api.get<DashboardSummary>('dashboard/summary', params);
  }
}
