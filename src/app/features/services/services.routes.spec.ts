import { Role } from '@shared/models/user.model';
import { SERVICE_MANAGE_ROLES, SERVICE_READ_ROLES, SERVICE_ROUTES } from './services.routes';

describe('Service routes', () => {
  it('defines one lazy catalogue route', () => {
    expect(SERVICE_ROUTES).toHaveLength(4);
    expect(SERVICE_ROUTES[0]).toMatchObject({ path: 'new', title: 'New service | Tailor' });
    expect(SERVICE_ROUTES[1]).toMatchObject({
      path: ':serviceId/edit',
      title: 'Edit service | Tailor',
    });
    expect(SERVICE_ROUTES[2]).toMatchObject({
      path: ':serviceId',
      title: 'Service details | Tailor',
    });
    expect(SERVICE_ROUTES[3]).toMatchObject({ path: '', title: 'Services | Tailor' });
    expect(SERVICE_ROUTES.every((route) => route.loadComponent)).toBe(true);
    expect(SERVICE_MANAGE_ROLES).toEqual([Role.SuperAdmin, Role.Manager]);
    expect(SERVICE_READ_ROLES).toEqual([
      Role.SuperAdmin,
      Role.Manager,
      Role.Receptionist,
      Role.Tailor,
    ]);
  });
});
