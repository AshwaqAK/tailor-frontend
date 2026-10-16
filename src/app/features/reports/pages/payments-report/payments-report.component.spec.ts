import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { PaymentMethod, PaymentStatus } from '@features/payments/models/payment.model';
import type { PaymentsReport } from '../../models/report.model';
import { ReportsApiService } from '../../data-access/reports-api.service';
import { PaymentsReportComponent } from './payments-report.component';

function createReport(overrides: Partial<PaymentsReport> = {}): PaymentsReport {
  return {
    grossCollections: 1500,
    refunds: 300,
    netCollections: 1200,
    paymentCounts: {
      byStatus: {
        [PaymentStatus.Pending]: 0,
        [PaymentStatus.Success]: 2,
        [PaymentStatus.Failed]: 0,
        [PaymentStatus.Refunded]: 1,
      },
      byMethod: {
        [PaymentMethod.Cash]: 1,
        [PaymentMethod.Upi]: 2,
        [PaymentMethod.Card]: 0,
        [PaymentMethod.BankTransfer]: 0,
        [PaymentMethod.Other]: 0,
      },
    },
    ...overrides,
  };
}

describe('PaymentsReportComponent', () => {
  it('renders backend gross, refund, net, status, and method metrics', async () => {
    const getPaymentsReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [PaymentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getPaymentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentsReportComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getPaymentsReport).toHaveBeenCalledWith({});
    expect(content).toContain('Gross collections');
    expect(content).toContain('Refund amount');
    expect(content).toContain('Net collections');
    expect(content).toContain('₹1,500.00');
    expect(content).toContain('₹300.00');
    expect(content).toContain('₹1,200.00');
    expect(content).toContain('Success');
    expect(content).toContain('Bank Transfer');
  });

  it('validates dates and sends supported payment filters', async () => {
    const getPaymentsReport = vi.fn(() => of(createReport()));

    await TestBed.configureTestingModule({
      imports: [PaymentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getPaymentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const component = TestBed.createComponent(PaymentsReportComponent).componentInstance;
    component.paymentFilterForm.setValue({
      fromDate: '2026-03-10',
      toDate: '2026-03-01',
      customerId: 'CUS-000001',
      paymentMethod: PaymentMethod.Card,
    });
    component.applyFilters();
    expect(getPaymentsReport).toHaveBeenCalledOnce();

    component.paymentFilterForm.setValue({
      fromDate: '2026-03-01',
      toDate: '2026-03-10',
      customerId: 'CUS-000001',
      paymentMethod: PaymentMethod.Card,
    });
    component.applyFilters();
    expect(getPaymentsReport).toHaveBeenNthCalledWith(2, {
      fromDate: '2026-03-01',
      toDate: '2026-03-10',
      customerId: 'CUS-000001',
      paymentMethod: PaymentMethod.Card,
    });
  });

  it('renders an empty result state', async () => {
    const getPaymentsReport = vi.fn(() =>
      of(
        createReport({
          grossCollections: 0,
          refunds: 0,
          netCollections: 0,
          paymentCounts: {
            byStatus: {
              [PaymentStatus.Pending]: 0,
              [PaymentStatus.Success]: 0,
              [PaymentStatus.Failed]: 0,
              [PaymentStatus.Refunded]: 0,
            },
            byMethod: {
              [PaymentMethod.Cash]: 0,
              [PaymentMethod.Upi]: 0,
              [PaymentMethod.Card]: 0,
              [PaymentMethod.BankTransfer]: 0,
              [PaymentMethod.Other]: 0,
            },
          },
        }),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [PaymentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getPaymentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentsReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No payments matched the selected filters.',
    );
  });

  it('renders a retryable API error', async () => {
    const getPaymentsReport = vi
      .fn()
      .mockImplementation(() => throwError(() => new ApiError('Payments unavailable', 503)));

    await TestBed.configureTestingModule({
      imports: [PaymentsReportComponent],
      providers: [
        { provide: ReportsApiService, useValue: { getPaymentsReport } },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentsReportComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Payments unavailable');
    expect(fixture.nativeElement.textContent).toContain('Try again');
  });
});
