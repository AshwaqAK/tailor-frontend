import { Role } from '@shared/models/user.model';
import {
  ALTERATION_CREATE_ROLES,
  ALTERATION_READ_ROLES,
  ALTERATION_ROUTES,
} from './alterations.routes';

describe('Alteration routes', () => {
  it('defines a protected create route for backend create roles', () => {
    expect(ALTERATION_ROUTES[0]).toMatchObject({
      path: 'new',
      title: 'Create alteration | Tailor',
    });
    expect(ALTERATION_ROUTES[0].loadComponent).toBeTypeOf('function');
    expect(ALTERATION_ROUTES[0].canMatch).toHaveLength(1);
    expect(ALTERATION_ROUTES[0].canDeactivate).toHaveLength(1);
    expect(ALTERATION_CREATE_ROLES).toEqual([Role.SuperAdmin, Role.Manager, Role.Receptionist]);
  });

  it('defines one lazy, role-protected list route for all alteration readers', () => {
    expect(ALTERATION_ROUTES).toHaveLength(4);
    expect(ALTERATION_ROUTES[3]).toMatchObject({ path: '', title: 'Alterations | Tailor' });
    expect(ALTERATION_ROUTES[3].loadComponent).toBeTypeOf('function');
    expect(ALTERATION_ROUTES[3].canMatch).toHaveLength(1);
    expect(ALTERATION_READ_ROLES).toEqual([
      Role.SuperAdmin,
      Role.Manager,
      Role.Receptionist,
      Role.Tailor,
    ]);
  });

  it('defines a business-ID detail route with the read guard and pending-change guard', () => {
    expect(ALTERATION_ROUTES[2]).toMatchObject({
      path: ':alterationId',
      title: 'Alteration details | Tailor',
    });
    expect(ALTERATION_ROUTES[2].loadComponent).toBeTypeOf('function');
    expect(ALTERATION_ROUTES[2].canMatch).toHaveLength(1);
    expect(ALTERATION_ROUTES[2].canDeactivate).toHaveLength(1);
  });

  it('defines a protected bill route with both business IDs', () => {
    expect(ALTERATION_ROUTES[1]).toMatchObject({
      path: ':alterationId/bill/:billingOrderId',
      title: 'Alteration bill | Tailor',
    });
    expect(ALTERATION_ROUTES[1].loadComponent).toBeTypeOf('function');
    expect(ALTERATION_ROUTES[1].canMatch).toHaveLength(1);
  });
});
