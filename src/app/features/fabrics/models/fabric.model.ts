import type { CursorPage } from '@shared/models/pagination.model';

export enum FabricType {
  Cotton = 'COTTON',
  Silk = 'SILK',
  SATIN = 'SATIN',
  Linen = 'LINEN',
  Wool = 'WOOL',
  Polyester = 'POLYESTER',
  Rayon = 'RAYON',
  Denim = 'DENIM',
  Blend = 'BLEND',
  Other = 'OTHER',
}

export enum QuantityUnit {
  Meter = 'METER',
  Piece = 'PIECE',
}

export interface Fabric {
  readonly _id: string;
  readonly fabricId: string;
  readonly name: string;
  readonly type: FabricType;
  readonly color: string;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly pricePerUnit: number;
  readonly supplier?: string;
  readonly description?: string;
  readonly isActive: boolean;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type FabricSortField =
  | 'fabricId'
  | 'name'
  | 'type'
  | 'color'
  | 'quantity'
  | 'pricePerUnit'
  | 'createdAt';

export interface FabricQuery {
  readonly cursor?: string;
  readonly limit: number;
  readonly name?: string;
  readonly type?: FabricType;
  readonly color?: string;
  readonly unit?: QuantityUnit;
  readonly isActive?: boolean;
  readonly sortBy: FabricSortField;
  readonly sortOrder: 'asc' | 'desc';
}

export type FabricListResponse = CursorPage<Fabric>;

export interface CreateFabricRequest {
  readonly name: string;
  readonly type: FabricType;
  readonly color: string;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly pricePerUnit: number;
  readonly supplier?: string;
  readonly description?: string;
  readonly isActive?: boolean;
}

export type UpdateFabricRequest = Partial<CreateFabricRequest>;
