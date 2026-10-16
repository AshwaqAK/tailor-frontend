import { signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { Role, type User } from '@shared/models/user.model';
import { AlterationsApiService } from '../../data-access/alterations-api.service';
import { AlterationStatus, type Alteration } from '../../models/alteration.model';
import type { Order } from '@features/orders/models/order.model';
import { AlterationDetailComponent } from './alteration-detail.component';

describe('AlterationDetailComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads and renders identifiers, optional dates, notes, and read-only charge', async () => {
    const alteration = createAlteration({ completionDate: undefined });
    const getByAlterationId = vi.fn(() => of(alteration));
    const { fixture, component } = await configure({ getByAlterationId });
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(getByAlterationId).toHaveBeenCalledWith('ALT-000123');
    expect(component.alteration()).toBe(alteration);
    expect(content).toContain('CUS-000001');
    expect(content).toContain('ORD-000002');
    expect(content).toContain('item-1');
    expect(
      (fixture.nativeElement.querySelector('#alteration-detail-description') as HTMLTextAreaElement)
        .value,
    ).toBe('Replace zipper');
    expect(content).toContain('₹125.50');
    expect(content).toContain('Not completed');
    expect(fixture.nativeElement.querySelector('#alteration-detail-charge')).toBeNull();
  });

  it('shows not-found state and does not request a missing alteration ID', async () => {
    const getByAlterationId = vi.fn();
    const { fixture, component } = await configure({ getByAlterationId }, '');
    fixture.detectChanges();
    expect(getByAlterationId).not.toHaveBeenCalled();
    expect(component.notFound()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Alteration not found');
  });

  it('allows valid transitions, confirms terminal changes, and refreshes after success', async () => {
    const completed = createAlteration({ status: AlterationStatus.Completed });
    const getByAlterationId = vi
      .fn()
      .mockReturnValueOnce(of(createAlteration()))
      .mockReturnValueOnce(of(completed));
    const update = vi.fn((id: string, request: unknown) => {
      void id;
      void request;
      return of(completed);
    });
    const { component } = await configure(
      { getByAlterationId, update },
      'ALT-000123',
      Role.Manager,
    );

    expect(component.allowedStatuses()).toEqual([
      AlterationStatus.InProgress,
      AlterationStatus.Cancelled,
    ]);
    component.updateStatus(AlterationStatus.Completed);
    expect(update).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.updateStatus(AlterationStatus.Cancelled);
    expect(update).toHaveBeenCalledWith('ALT-000123', { status: AlterationStatus.Cancelled });
    expect(update.mock.calls[0][1]).not.toHaveProperty('completionDate');
    expect(getByAlterationId).toHaveBeenCalledTimes(2);
    expect(component.alteration()?.status).toBe(AlterationStatus.Completed);
  });

  it('prevents status updates for terminal or unauthorized states', async () => {
    const update = vi.fn((id: string, request: unknown) => {
      void id;
      void request;
      return of(createAlteration());
    });
    const { component } = await configure(
      {
        getByAlterationId: vi.fn(() =>
          of(createAlteration({ status: AlterationStatus.Completed })),
        ),
        update,
      },
      'ALT-000123',
      Role.Tailor,
    );

    expect(component.allowedStatuses()).toEqual([]);
    component.updateStatus(AlterationStatus.InProgress);
    expect(update).not.toHaveBeenCalled();
  });

  it('prevents duplicate status submissions while one is pending', async () => {
    const updateResponse = new Subject<Alteration>();
    const update = vi.fn((id: string, request: unknown) => {
      void id;
      void request;
      return updateResponse;
    });
    const { component } = await configure(
      { getByAlterationId: vi.fn(() => of(createAlteration())), update },
      'ALT-000123',
      Role.Receptionist,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.updateStatus(AlterationStatus.InProgress);
    component.updateStatus(AlterationStatus.InProgress);
    expect(update).toHaveBeenCalledOnce();
    expect(component.updatingStatus()).toBe(true);
    updateResponse.next(createAlteration({ status: AlterationStatus.InProgress }));
    expect(component.updatingStatus()).toBe(false);
  });

  it('creates a bill only for a completed positive-charge alteration and navigates by orderId', async () => {
    const createBill = vi.fn((id: string) => {
      void id;
      return of({ orderId: 'ORD-000099' } as Order);
    });
    const { component } = await configure(
      {
        getByAlterationId: vi.fn(() =>
          of(createAlteration({ status: AlterationStatus.Completed })),
        ),
        createBill,
      },
      'ALT-000123',
      Role.Manager,
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.createBill();

    expect(createBill).toHaveBeenCalledWith('ALT-000123');
    expect(navigate).toHaveBeenCalledWith(['/alterations', 'ALT-000123', 'bill', 'ORD-000099']);
  });

  it('handles an already-billed conflict without navigating or reporting success', async () => {
    const getByAlterationId = vi
      .fn()
      .mockReturnValueOnce(of(createAlteration({ status: AlterationStatus.Completed })))
      .mockReturnValueOnce(of(createAlteration({ status: AlterationStatus.Completed })));
    const createBill = vi.fn(() => throwError(() => new ApiError('Conflict', 409)));
    const { component } = await configure(
      {
        getByAlterationId,
        createBill,
      },
      'ALT-000123',
      Role.Manager,
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.createBill();

    expect(component.billError()).toContain('may already exist');
    expect(navigate).not.toHaveBeenCalled();
    expect(getByAlterationId).toHaveBeenCalledTimes(2);
  });

  it('does not create bills for non-completed, zero-charge, or unauthorized alterations', async () => {
    const createBill = vi.fn(() => of({ orderId: 'ORD-000099' } as Order));
    const { component } = await configure(
      {
        getByAlterationId: vi.fn(() =>
          of(createAlteration({ status: AlterationStatus.Requested, charge: 0 })),
        ),
        createBill,
      },
      'ALT-000123',
      Role.Tailor,
    );
    component.createBill();
    expect(createBill).not.toHaveBeenCalled();
  });

  it('saves description and notes without sending charge and displays API errors', async () => {
    const update = vi.fn((id: string, request: unknown) => {
      void id;
      void request;
      return of(createAlteration({ description: 'Updated', notes: '' }));
    });
    const { component } = await configure(
      { getByAlterationId: vi.fn(() => of(createAlteration())), update },
      'ALT-000123',
      Role.Manager,
    );
    component.form.patchValue({ description: 'Updated', notes: '' });
    component.saveDetails();
    expect(update).toHaveBeenCalledWith('ALT-000123', { description: 'Updated', notes: '' });
    expect(update.mock.calls[0][1]).not.toHaveProperty('charge');

    const failingUpdate = vi.fn(() => throwError(() => new ApiError('Update rejected', 409)));
    TestBed.resetTestingModule();
    const failing = await configure(
      { getByAlterationId: vi.fn(() => of(createAlteration())), update: failingUpdate },
      'ALT-000123',
      Role.Manager,
    );
    failing.component.form.controls.description.setValue('Changed');
    failing.component.saveDetails();
    expect(failing.component.error()).toBe('Update rejected');
  });
});

async function configure(
  api: {
    getByAlterationId: () => unknown;
    update?: (id: string, request: unknown) => unknown;
    createBill?: (id: string) => unknown;
  },
  alterationId = 'ALT-000123',
  role?: Role,
): Promise<{
  fixture: ComponentFixture<AlterationDetailComponent>;
  component: AlterationDetailComponent;
}> {
  await TestBed.configureTestingModule({
    imports: [AlterationDetailComponent],
    providers: [
      provideRouter([]),
      {
        provide: AlterationsApiService,
        useValue: {
          getByAlterationId: api.getByAlterationId,
          update: api.update ?? vi.fn(),
          createBill: api.createBill ?? vi.fn(),
        },
      },
      { provide: AuthService, useValue: { user: signal(role ? user(role) : null).asReadonly() } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => alterationId } } },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AlterationDetailComponent);
  return { fixture, component: fixture.componentInstance };
}

function user(role: Role): User {
  return {
    id: 'id',
    userId: 'USR-000001',
    name: 'Test user',
    email: 'test@example.com',
    role,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

function createAlteration(overrides: Partial<Alteration> = {}): Alteration {
  return {
    _id: 'mongo-id',
    alterationId: 'ALT-000123',
    customerId: 'CUS-000001',
    originalOrderId: 'ORD-000002',
    originalOrderItemId: 'item-1',
    description: 'Replace zipper',
    notes: 'Use matching thread',
    charge: 125.5,
    status: AlterationStatus.Requested,
    requestDate: '2026-01-15T10:30:00.000Z',
    completionDate: '2026-01-20T10:30:00.000Z',
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}
