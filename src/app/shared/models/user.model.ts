export enum Role {
  SuperAdmin = 'SUPER_ADMIN',
  Manager = 'MANAGER',
  Tailor = 'TAILOR',
  Receptionist = 'RECEPTIONIST',
}

export interface User {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly role: Role;
  readonly isActive: boolean;
  readonly lastLoginAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
