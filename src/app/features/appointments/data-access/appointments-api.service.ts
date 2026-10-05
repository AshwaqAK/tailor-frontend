import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '@core/api/api.service';
import type {
  Appointment,
  AppointmentQuery,
  CreateAppointmentRequest,
  PaginatedAppointments,
  UpdateAppointmentRequest,
} from '../models/appointment.model';

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  private readonly api = inject(ApiService);

  list(query: AppointmentQuery = {}): Observable<PaginatedAppointments> {
    let params = new HttpParams();
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.limit !== undefined) params = params.set('limit', query.limit);
    if (query.customerId) params = params.set('customerId', query.customerId);
    if (query.orderId) params = params.set('orderId', query.orderId);
    if (query.appointmentDate) params = params.set('appointmentDate', query.appointmentDate);
    if (query.type) params = params.set('type', query.type);
    if (query.status) params = params.set('status', query.status);
    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortOrder) params = params.set('sortOrder', query.sortOrder);

    return this.api.get<PaginatedAppointments>('appointments', params);
  }

  create(request: CreateAppointmentRequest): Observable<Appointment> {
    return this.api.post<Appointment, CreateAppointmentRequest>('appointments', request);
  }

  update(appointmentId: string, request: UpdateAppointmentRequest): Observable<Appointment> {
    return this.api.patch<Appointment, UpdateAppointmentRequest>(
      `appointments/${encodeURIComponent(appointmentId)}`,
      request,
    );
  }

  remove(appointmentId: string): Observable<Appointment> {
    return this.api.delete<Appointment>(`appointments/${encodeURIComponent(appointmentId)}`);
  }
}
