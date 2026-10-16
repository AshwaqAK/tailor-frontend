export enum AlterationStatus {
  Requested = 'REQUESTED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export const ALTERATION_STATUS_TRANSITIONS: Readonly<
  Record<AlterationStatus, readonly AlterationStatus[]>
> = {
  [AlterationStatus.Requested]: [AlterationStatus.InProgress, AlterationStatus.Cancelled],
  [AlterationStatus.InProgress]: [AlterationStatus.Completed, AlterationStatus.Cancelled],
  [AlterationStatus.Completed]: [],
  [AlterationStatus.Cancelled]: [],
};

export type AlterationSortField = 'requestDate' | 'status' | 'createdAt';
export type AlterationSortOrder = 'asc' | 'desc';

export interface Alteration {
  readonly _id: string;
  readonly alterationId: string;
  readonly customerId: string;
  readonly originalOrderId: string;
  readonly originalOrderItemId: string;
  readonly description: string;
  readonly notes?: string;
  readonly charge: number;
  readonly status: AlterationStatus;
  readonly requestDate?: string;
  readonly completionDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAlterationRequest {
  readonly customerId: string;
  readonly originalOrderId: string;
  readonly originalOrderItemId: string;
  readonly description: string;
  readonly notes?: string;
  readonly charge?: number;
}

export interface UpdateAlterationRequest {
  readonly description?: string;
  readonly notes?: string;
  readonly charge?: number;
  readonly status?: AlterationStatus;
}

export interface AlterationQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly customerId?: string;
  readonly orderId?: string;
  readonly status?: AlterationStatus;
  readonly sortBy?: AlterationSortField;
  readonly sortOrder?: AlterationSortOrder;
}

export interface AlterationListMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface AlterationListResponse {
  readonly data: readonly Alteration[];
  readonly meta: AlterationListMeta;
}
