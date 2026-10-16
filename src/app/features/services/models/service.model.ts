import type { CursorPage, CursorPageMeta } from '@shared/models/pagination.model';

export type ServiceSortField = 'serviceId' | 'name' | 'category' | 'price' | 'createdAt';

export enum ServiceCategory {
  Stitching = 'STITCHING',
  Alteration = 'ALTERATION',
  CustomTailoring = 'CUSTOM_TAILORING',
  Repair = 'REPAIR',
  Other = 'OTHER',
}

export interface Service {
  readonly _id: string;
  readonly serviceId: string;
  readonly name: string;
  readonly category: ServiceCategory;
  readonly price: number;
  readonly isActive: boolean;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly description?: string;
}

export interface ServiceQuery {
  readonly cursor?: string;
  readonly limit: number;
  readonly sortBy: ServiceSortField;
  readonly sortOrder: 'asc' | 'desc';
  readonly name?: string;
  readonly category?: ServiceCategory;
  readonly isActive?: boolean;
}

export type ServiceListMeta = CursorPageMeta;
export type ServiceListResponse = CursorPage<Service>;

export interface CreateServiceRequest {
  readonly name: string;
  readonly category: ServiceCategory;
  readonly price: number;
  readonly description?: string;
  readonly isActive?: boolean;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest>;
