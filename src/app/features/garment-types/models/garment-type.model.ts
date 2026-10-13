export enum PricingType {
  Fixed = 'FIXED',
  PerUnit = 'PER_UNIT',
}

export enum CustomizationInputType {
  SingleSelect = 'SINGLE_SELECT',
  MultiSelect = 'MULTI_SELECT',
  Boolean = 'BOOLEAN',
  Number = 'NUMBER',
  Text = 'TEXT',
}

export enum MeasurementUnit {
  Inch = 'INCH',
}

export interface TailoringService {
  readonly serviceId: string;
  readonly name?: string;
  readonly basePrice: number;
}

export interface CustomizationOption {
  readonly name: string;
  readonly inputType: CustomizationInputType;
  readonly price: number;
  readonly pricingType: PricingType;
  readonly sortOrder: number;
}

export interface CustomizationGroup {
  readonly name: string;
  readonly sortOrder: number;
  readonly options: readonly CustomizationOption[];
}

export interface MeasurementField {
  readonly key: string;
  readonly name: string;
  readonly unit: MeasurementUnit;
  readonly required: boolean;
  readonly sortOrder: number;
}

export interface GarmentType {
  readonly _id: string;
  readonly garmentTypeId: string;
  readonly name: string;
  readonly code: string;
  readonly description?: string;
  readonly tailoringService: TailoringService;
  readonly customizationGroups: readonly CustomizationGroup[];
  readonly measurementFields: readonly MeasurementField[];
  readonly isActive: boolean;
  readonly createdBy?: string;
  readonly updatedBy?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface CreateGarmentTypeRequest {
  readonly name: string;
  readonly code: string;
  readonly description?: string;
  readonly tailoringService: TailoringService;
  readonly customizationGroups: readonly CustomizationGroup[];
  readonly measurementFields: readonly MeasurementField[];
  readonly isActive?: boolean;
}

export type UpdateGarmentTypeRequest = Partial<CreateGarmentTypeRequest>;
