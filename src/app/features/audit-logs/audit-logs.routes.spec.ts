import { Role } from '@shared/models/user.model';
import { AUDIT_LOG_ROUTES } from './audit-logs.routes';

describe('Audit log routes', () => {
  it('defines one lazy, role-protected list route', () => {
    expect(AUDIT_LOG_ROUTES).toHaveLength(2);

    expect(AUDIT_LOG_ROUTES[0]).toMatchObject({
      path: ':auditLogId',
      title: 'Audit Log details | Tailor',
    });
    expect(AUDIT_LOG_ROUTES[0].loadComponent).toBeTypeOf('function');
    expect(AUDIT_LOG_ROUTES[0].canMatch).toHaveLength(1);

    expect(AUDIT_LOG_ROUTES[1]).toMatchObject({ path: '', title: 'Audit Logs | Tailor' });
    expect(AUDIT_LOG_ROUTES[1].loadComponent).toBeTypeOf('function');
    expect(AUDIT_LOG_ROUTES[1].canMatch).toHaveLength(1);

    expect(Role.SuperAdmin).toBe('SUPER_ADMIN');
    expect(Role.Manager).toBe('MANAGER');
  });
});
