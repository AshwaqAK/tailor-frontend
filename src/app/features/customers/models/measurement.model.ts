export enum ClothingType {
  Kurta = 'KURTA',
  Pajama = 'PAJAMA',
  Dhoti = 'DHOTI',
  Shirt = 'SHIRT',
  Trouser = 'TROUSER',
  Waistcoat = 'WAISTCOAT',
  Blazer = 'BLAZER',
}

export enum FitPreference {
  Slim = 'SLIM',
  Regular = 'REGULAR',
  Loose = 'LOOSE',
}

export interface Measurement {
  readonly _id: string;
  readonly customerId: string;
  readonly clothingType: ClothingType;
  readonly version: number;
  readonly measurements: Readonly<Record<string, number>>;
  readonly fitPreference?: FitPreference;
  readonly notes?: string;
  readonly measuredAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateMeasurementRequest {
  readonly customerId: string;
  readonly clothingType: ClothingType;
  readonly version: number;
  readonly measurements: Readonly<Record<string, number>>;
  readonly fitPreference?: FitPreference;
  readonly notes?: string;
  readonly measuredAt: string;
}

export type UpdateMeasurementRequest = Partial<CreateMeasurementRequest>;
