import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { ServicesApiService } from '../../data-access/services-api.service';
import {
  ServiceCategory,
  type Service,
  type ServiceListResponse,
} from '../../models/service.model';
import { ServiceListComponent } from './service-list.component';

describe('ServiceListComponent', () => {
  it('renders the catalogue response and uses backend pagination', async () => {
    const list = vi.fn(() => of(page([service()])));
    await configure(list);
    const fixture = TestBed.createComponent(ServiceListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SRV-000001');
    expect(fixture.nativeElement.textContent).toContain('Pressing');
    expect(fixture.nativeElement.textContent).toContain('₹250.00');
    expect(list).toHaveBeenCalledWith({ limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('forwards next cursors and restores previous cursors', async () => {
    const responses = [
      page([service()], { hasNextPage: true, nextCursor: 'opaque-next' }),
      page([service({ serviceId: 'SRV-000002' })]),
      page([service()]),
    ];
    const list = vi.fn(() => of(responses.shift()!));
    await configure(list);
    const component = TestBed.createComponent(ServiceListComponent).componentInstance;
    component.nextPage();
    expect(list).toHaveBeenLastCalledWith({
      cursor: 'opaque-next',
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    component.previousPage();
    expect(list).toHaveBeenLastCalledWith({ limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('resets cursor history when sorting or page size changes', async () => {
    const list = vi.fn(() => of(page([], { hasNextPage: true, nextCursor: 'next' })));
    await configure(list);
    const component = TestBed.createComponent(ServiceListComponent).componentInstance;
    component.nextPage();
    component.sortBy.setValue('price');
    component.sortOrder.setValue('asc');
    component.pageSize.setValue(100);
    component.applySorting();
    expect(list).toHaveBeenLastCalledWith({ limit: 100, sortBy: 'price', sortOrder: 'asc' });
  });

  it('handles empty and error states and ignores stale responses', async () => {
    const first = new Subject<ServiceListResponse>();
    const second = new Subject<ServiceListResponse>();
    const list = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    await configure(list);
    const fixture = TestBed.createComponent(ServiceListComponent);
    fixture.detectChanges();
    fixture.componentInstance.applySorting();
    first.next(page([service({ serviceId: 'OLD' })]));
    expect(fixture.componentInstance.services()).toEqual([]);
    second.next(page([]));
    second.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No services found');

    list.mockReturnValueOnce(throwError(() => new ApiError('Forbidden', 403)));
    fixture.componentInstance.retry();
    expect(fixture.componentInstance.error()).toBe('Forbidden');
  });
});

async function configure(list: (query: unknown) => unknown): Promise<void> {
  const params = new BehaviorSubject(convertToParamMap({}));
  await TestBed.configureTestingModule({
    imports: [ServiceListComponent],
    providers: [
      { provide: ServicesApiService, useValue: { list } },
      {
        provide: ActivatedRoute,
        useValue: {
          queryParamMap: params.asObservable(),
          snapshot: { queryParamMap: convertToParamMap({}) },
        },
      },
      provideRouter([]),
    ],
  }).compileComponents();
}

function page(
  data: readonly Service[],
  overrides: Partial<ServiceListResponse['meta']> = {},
): ServiceListResponse {
  return { data, meta: { limit: 20, hasNextPage: false, nextCursor: null, ...overrides } };
}

function service(overrides: Partial<Service> = {}): Service {
  return {
    serviceId: 'SRV-000001',
    name: 'Pressing',
    category: ServiceCategory.Other,
    price: 250,
    isActive: true,
    createdAt: '2026-01-15T00:00:00.000Z',
    _id: 'service-mongo-id',
    createdBy: 'USR-000001',
    updatedBy: 'USR-000001',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}
