import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { Role } from '@shared/models/user.model';
import { ServicesApiService } from '../../data-access/services-api.service';
import { ServiceCategory, type Service } from '../../models/service.model';
import { ServiceDetailsComponent } from './service-details.component';

describe('ServiceDetailsComponent', () => {
  it('loads details and refreshes after activation change', async () => {
    const service = createService();
    const updated = { ...service, isActive: false };
    const getById = vi.fn(() => of(service));
    const update = vi.fn(() => of(updated));
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    await configure({ getById, update, remove: vi.fn() }, Role.Manager);
    const fixture = TestBed.createComponent(ServiceDetailsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SRV-000001');
    fixture.componentInstance.toggleActive();
    expect(update).toHaveBeenCalledWith('SRV-000001', { isActive: false });
    expect(fixture.componentInstance.service()?.isActive).toBe(false);
  });

  it('prevents delete controls for read-only roles', async () => {
    await configure(
      { getById: vi.fn(() => of(createService())), update: vi.fn(), remove: vi.fn() },
      Role.Receptionist,
    );
    const fixture = TestBed.createComponent(ServiceDetailsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Delete permanently');
  });
});

async function configure(api: Record<string, unknown>, role: Role): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ServiceDetailsComponent],
    providers: [
      provideRouter([]),
      { provide: ServicesApiService, useValue: api },
      { provide: AuthService, useValue: { user: signal({ role }).asReadonly() } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: vi.fn(() => 'SRV-000001') } } },
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
  };
}
