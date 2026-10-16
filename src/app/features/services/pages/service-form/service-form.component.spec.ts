import { ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { ApiError } from '@core/api/api-error';
import { ServicesApiService } from '../../data-access/services-api.service';
import { ServiceCategory, type Service } from '../../models/service.model';
import { ServiceFormComponent } from './service-form.component';

describe('ServiceFormComponent', () => {
  it('validates fields, submits only supported fields, and prevents duplicates', async () => {
    const response = new Subject<Service>();
    const create = vi.fn(() => response);
    await configure({ create, getById: vi.fn() }, null);
    const component = TestBed.createComponent(ServiceFormComponent).componentInstance;
    component.form.patchValue({
      name: '  Pressing ',
      category: ServiceCategory.Repair,
      price: 12.345,
    });
    expect(component.form.controls.price.invalid).toBe(true);
    component.form.controls.price.setValue(125.5);
    component.form.controls.description.setValue(' Steam press ');
    component.form.controls.isActive.setValue(true);
    component.submit();
    component.submit();
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      name: 'Pressing',
      category: ServiceCategory.Repair,
      price: 125.5,
      description: 'Steam press',
      isActive: true,
    });
    response.error(new ApiError('Invalid service', 422));
    expect(component.error()).toBe('Invalid service');
  });

  it('loads edit values without exposing server-managed fields', async () => {
    const service = createService();
    const update = vi.fn(() => of(service));
    await configure({ create: vi.fn(), getById: vi.fn(() => of(service)), update }, 'SRV-000001');
    const component = TestBed.createComponent(ServiceFormComponent).componentInstance;
    expect(component.form.getRawValue()).toMatchObject({
      name: service.name,
      category: service.category,
      price: service.price,
    });
  });
});

async function configure(api: Record<string, unknown>, serviceId: string | null): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ServiceFormComponent],
    providers: [
      provideRouter([]),
      { provide: ServicesApiService, useValue: api },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: vi.fn(() => serviceId) } } },
      },
    ],
  }).compileComponents();
}

function createService(): Service {
  return {
    _id: 'mongo-id',
    serviceId: 'SRV-000001',
    name: 'Pressing',
    category: ServiceCategory.Repair,
    price: 125.5,
    isActive: true,
    createdBy: 'USR-000001',
    updatedBy: 'USR-000001',
    createdAt: '',
    updatedAt: '',
    description: 'Steam press',
  };
}
