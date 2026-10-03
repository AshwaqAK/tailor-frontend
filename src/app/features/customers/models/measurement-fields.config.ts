import { ClothingType } from './measurement.model';

export type MeasurementFieldKey =
  | 'shoulder'
  | 'neck'
  | 'chest'
  | 'waist'
  | 'hip'
  | 'kurtaLength'
  | 'shirtLength'
  | 'blazerLength'
  | 'fullLength'
  | 'frontLength'
  | 'backLength'
  | 'sleeveLength'
  | 'armhole'
  | 'bicep'
  | 'cuff'
  | 'inseam'
  | 'outseam'
  | 'thigh'
  | 'knee'
  | 'bottomOpening'
  | 'bottomWidth'
  | 'rise';

export interface MeasurementFieldDefinition {
  readonly key: MeasurementFieldKey;
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
}

const LABELS: Readonly<Record<MeasurementFieldKey, string>> = {
  shoulder: 'Shoulder',
  neck: 'Neck',
  chest: 'Chest',
  waist: 'Waist',
  hip: 'Hip / Seat',
  kurtaLength: 'Kurta Length',
  shirtLength: 'Shirt Length',
  blazerLength: 'Blazer Length',
  fullLength: 'Full Length',
  frontLength: 'Front Length',
  backLength: 'Back Length',
  sleeveLength: 'Sleeve Length',
  armhole: 'Armhole',
  bicep: 'Bicep',
  cuff: 'Cuff',
  inseam: 'Inseam',
  outseam: 'Outside Length',
  thigh: 'Thigh',
  knee: 'Knee',
  bottomOpening: 'Bottom Opening',
  bottomWidth: 'Bottom Width',
  rise: 'Rise',
};

function fields(
  required: readonly MeasurementFieldKey[],
  optional: readonly MeasurementFieldKey[],
): readonly MeasurementFieldDefinition[] {
  return [...required, ...optional].map((key, index) => ({
    key,
    label: LABELS[key],
    required: required.includes(key),
    order: index + 1,
  }));
}

export const MEASUREMENT_FIELDS: Readonly<
  Record<ClothingType, readonly MeasurementFieldDefinition[]>
> = {
  [ClothingType.Kurta]: fields(
    ['shoulder', 'neck', 'chest', 'waist', 'kurtaLength', 'sleeveLength'],
    ['hip', 'armhole', 'bicep', 'cuff'],
  ),
  [ClothingType.Pajama]: fields(
    ['waist', 'hip', 'fullLength', 'thigh', 'bottomOpening'],
    ['inseam', 'knee', 'rise'],
  ),
  [ClothingType.Dhoti]: fields(['waist', 'fullLength'], ['hip', 'bottomWidth']),
  [ClothingType.Shirt]: fields(
    ['neck', 'shoulder', 'chest', 'waist', 'shirtLength', 'sleeveLength'],
    ['hip', 'armhole', 'bicep', 'cuff'],
  ),
  [ClothingType.Trouser]: fields(
    ['waist', 'hip', 'outseam', 'inseam', 'thigh', 'bottomOpening'],
    ['knee', 'rise'],
  ),
  [ClothingType.Waistcoat]: fields(
    ['shoulder', 'chest', 'waist', 'frontLength'],
    ['hip', 'backLength', 'armhole'],
  ),
  [ClothingType.Blazer]: fields(
    ['shoulder', 'chest', 'waist', 'hip', 'blazerLength', 'sleeveLength'],
    ['neck', 'armhole', 'bicep', 'cuff'],
  ),
};
