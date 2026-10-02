import { HttpClient, type HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { APP_CONFIG } from '@core/config/app-config';
import type { ApiSuccess } from '@shared/models/api.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), { params, withCredentials: true })
      .pipe(map((response) => response.data));
  }

  post<T, TBody = unknown>(path: string, body: TBody): Observable<T> {
    return this.http
      .post<ApiSuccess<T>>(this.url(path), body, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  patch<T, TBody = unknown>(path: string, body: TBody): Observable<T> {
    return this.http
      .patch<ApiSuccess<T>>(this.url(path), body, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiSuccess<T>>(this.url(path), { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  private url(path: string): string {
    return `${this.config.apiBaseUrl}/${path.replace(/^\//, '')}`;
  }
}
