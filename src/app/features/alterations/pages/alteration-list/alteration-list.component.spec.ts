import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import {
  AlterationStatus,
  type Alteration,
  type AlterationListResponse,
} from '../../models/alteration.model';
import { AlterationListComponent } from './alteration-list.component';

describe('AlterationListComponent', () => {
  it('renders returned alteration fields with INR and date formatting', async () => {
    const alteration = createAlteration();
    const list = vi.fn(() => of(pageOf([alteration])));
    await configure(list);

    const fixture = TestBed.createComponent(AlterationListComponent);
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('ALT-000123');
    expect(content).toContain('CUS-000001');
    expect(content).toContain('ORD-000002');
    expect(content).toContain(alteration.originalOrderItemId);
    expect(content).toContain('Shorten sleeve');
    expect(content).toContain('In Progress');
    expect(content).toContain('₹250.00');
    expect(content).toContain('Jan 15, 2026');
  });

  it('validates business IDs and serializes applied filters without empty values', async () => {
    const list = vi.fn(() => of(pageOf([])));
    await configure(list);

    const component = TestBed.createComponent(AlterationListComponent).componentInstance;
    component.filterForm.controls.customerId.setValue('CUS-123');
    component.filterForm.controls.orderId.setValue('ORD-000002');
    component.applyFilters();

    expect(component.filterForm.controls.customerId.hasError('invalidBusinessId')).toBe(true);
    expect(list).toHaveBeenCalledOnce();

    component.filterForm.controls.customerId.setValue('CUS-000001');
    component.filterForm.controls.status.setValue(AlterationStatus.Completed);
    component.filterForm.controls.sortBy.setValue('requestDate');
    component.filterForm.controls.sortOrder.setValue('asc');
    component.applyFilters();

    expect(list).toHaveBeenLastCalledWith({
      limit: 20,
      customerId: 'CUS-000001',
      orderId: 'ORD-000002',
      status: AlterationStatus.Completed,
      sortBy: 'requestDate',
      sortOrder: 'asc',
    });
  });

  it('uses backend pagination and resets page when sorting changes', async () => {
    const list = vi.fn(() => of(pageOf([], { hasNextPage: true, nextCursor: 'opaque-token' })));
    await configure(list);

    const component = TestBed.createComponent(AlterationListComponent).componentInstance;
    component.nextPage();
    expect(list).toHaveBeenLastCalledWith({
      limit: 20,
      cursor: 'opaque-token',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    component.sortBy('status');
    expect(list).toHaveBeenLastCalledWith({
      limit: 20,
      sortBy: 'status',
      sortOrder: 'asc',
    });
  });

  it('ignores a stale response after a newer request and exposes loading state', async () => {
    const first = new Subject<AlterationListResponse>();
    const second = new Subject<AlterationListResponse>();
    const list = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    await configure(list);

    const component = TestBed.createComponent(AlterationListComponent).componentInstance;
    component.applyFilters();
    first.next(pageOf([createAlteration({ alterationId: 'ALT-OLD' })]));
    expect(component.alterations()).toEqual([]);
    expect(component.loading()).toBe(true);

    second.next(pageOf([createAlteration({ alterationId: 'ALT-CURRENT' })]));
    second.complete();
    expect(component.alterations()[0]?.alterationId).toBe('ALT-CURRENT');
    expect(component.loading()).toBe(false);
  });

  it('renders empty and API error states and retries', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(of(pageOf([])))
      .mockReturnValueOnce(throwError(() => new ApiError('Forbidden', 403)))
      .mockReturnValueOnce(of(pageOf([createAlteration()])));
    await configure(list);

    const fixture = TestBed.createComponent(AlterationListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No alterations found');

    const component = fixture.componentInstance;
    component.retry();
    fixture.detectChanges();
    expect(component.error()).toBe('Forbidden');

    component.retry();
    fixture.detectChanges();
    expect(component.error()).toBeNull();
    expect(component.alterations()).toHaveLength(1);
  });
});

async function configure(list: (query: unknown) => unknown): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [AlterationListComponent],
    providers: [
      { provide: AlterationsApiService, useValue: { list } },
      { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
      provideRouter([]),
    ],
  }).compileComponents();
}

function pageOf(
  data: readonly Alteration[],
  overrides: Partial<AlterationListResponse['meta']> = {},
): AlterationListResponse {
  return {
    data,
    meta: { limit: 20, hasNextPage: false, nextCursor: null, ...overrides },
  };
}

function createAlteration(overrides: Partial<Alteration> = {}): Alteration {
  return {
    _id: 'mongodb-id',
    alterationId: 'ALT-000123',
    customerId: 'CUS-000001',
    originalOrderId: 'ORD-000002',
    originalOrderItemId: '65f1d7b7c3b7e3d7e3d7e3d7',
    description: 'Shorten sleeve',
    charge: 250,
    status: AlterationStatus.InProgress,
    requestDate: '2026-01-15T10:30:00.000Z',
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}
