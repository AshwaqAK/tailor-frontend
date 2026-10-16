import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type { AuditLog, AuditLogListResponse, AuditLogQuery } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogsApiService {
  private readonly api = inject(ApiService);

  list(query: AuditLogQuery = {}): Observable<AuditLogListResponse> {
    let params = new HttpParams();

    if (query.limit !== undefined) params = params.set('limit', query.limit);
    if (query.cursor) params = params.set('cursor', query.cursor);
    if (query.actorId?.trim()) params = params.set('actorId', query.actorId.trim());
    if (query.action) params = params.set('action', query.action);
    if (query.entityType) params = params.set('entityType', query.entityType);
    if (query.entityId?.trim()) params = params.set('entityId', query.entityId.trim());
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);

    return this.api.get<AuditLogListResponse>('audit-logs', params);
  }

  getByAuditId(auditId: string): Observable<AuditLog> {
    return this.api.get<AuditLog>(`audit-logs/${encodeURIComponent(auditId)}`);
  }
}
