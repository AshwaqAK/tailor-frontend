import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import {
  AppointmentStatus,
  AppointmentType,
} from '@features/appointments/models/appointment.model';
import type { AppointmentsReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { AppointmentsReportComponent } from './appointments-report.component';

function createReport(overrides: Partial<AppointmentsReport> = {}): AppointmentsReport {
  return {
    totalAppointments: 3,
    appointmentsByStatus: {
      [AppointmentStatus.Scheduled]: 1,
      [AppointmentStatus.Confirmed]: 1,
      [AppointmentStatus.Completed]: 1,
      [AppointmentStatus.Cancelled]: 0,
      [AppointmentStatus.NoShow]: 0,
    },
    appointmentsByType: {
      [AppointmentType.Consultation]: 0,
      [AppointmentType.Measurement]: 0,
      [AppointmentType.Fitting]: 2,
      [AppointmentType.Trial]: 1,
      [AppointmentType.Pickup]: 0,
    },
    ...overrides,
  };
}

describe('AppointmentsReportComponent', () => {
  it('renders backend total, status counts, and type counts', async () => {
    const getAppointmentsReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [AppointmentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getAppointmentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppointmentsReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getAppointmentsReport).toHaveBeenCalledWith({});
    expect(content).toContain('Total appointments');
    expect(content).toContain('Appointments by status');
    expect(content).toContain('Appointments by type');
    expect(content).toContain('Scheduled');
    expect(content).toContain('Fitting');
  });

  it('validates the date range and sends appointment-date filters unchanged', async () => {
    const getAppointmentsReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [AppointmentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getAppointmentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(AppointmentsReportComponent).componentInstance;
    component.dateRangeForm.setValue({ fromDate: '2026-05-10', toDate: '2026-05-01' });
    component.applyDateRange();
    expect(getAppointmentsReport).toHaveBeenCalledOnce();

    component.dateRangeForm.setValue({ fromDate: '2026-05-01', toDate: '2026-05-10' });
    component.applyDateRange();
    expect(getAppointmentsReport).toHaveBeenNthCalledWith(2, {
      fromDate: '2026-05-01',
      toDate: '2026-05-10',
    });
  });

  it('renders an empty state for zero appointments', async () => {
    const getAppointmentsReport = vi.fn(() => of(createReport({ totalAppointments: 0 })));

    await TestBed.configureTestingModule({
      imports: [AppointmentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getAppointmentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppointmentsReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No appointments matched the selected dates.',
    );
  });

  it('renders a retryable API error', async () => {
    const getAppointmentsReport = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Appointments unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [AppointmentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getAppointmentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppointmentsReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Appointments unavailable');
    expect(fixture.nativeElement.textContent).toContain('Try again');
  });
});
