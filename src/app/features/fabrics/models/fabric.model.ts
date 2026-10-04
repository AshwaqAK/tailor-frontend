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
  readonly page: number;
  readonly limit: number;
  readonly name?: string;
  readonly type?: FabricType;
  readonly color?: string;
  readonly unit?: QuantityUnit;
  readonly isActive?: boolean;
  readonly sortBy: FabricSortField;
  readonly sortOrder: 'asc' | 'desc';
}

export interface FabricListResponse {
  readonly data: readonly Fabric[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

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
