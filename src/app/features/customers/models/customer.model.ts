export enum CustomerGender {
  Male = 'MALE',
  Female = 'FEMALE',
  Other = 'OTHER',
}

export type CustomerSortField = 'name' | 'phone' | 'customerId' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface Customer {
  readonly _id: string;
  readonly customerId: string;
  readonly name: string;
  readonly phone: string;
  readonly alternatePhone?: string;
  readonly email?: string;
  readonly gender: CustomerGender;
  readonly photo?: string;
  readonly notes?: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerListMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface CustomerListResponse {
  readonly data: readonly Customer[];
  readonly meta: CustomerListMeta;
}

export interface CustomerQuery {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly sortBy: CustomerSortField;
  readonly sortOrder: SortOrder;
  readonly isActive?: boolean;
}

export interface CreateCustomerRequest {
  readonly name: string;
  readonly phone: string;
  readonly alternatePhone?: string;
  readonly email?: string;
  readonly gender?: CustomerGender;
  readonly photo?: string;
  readonly notes?: string;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;
