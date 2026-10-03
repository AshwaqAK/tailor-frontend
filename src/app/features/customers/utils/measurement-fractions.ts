export const MEASUREMENT_STEP = 0.125;

export interface FractionOption {
  readonly value: number;
  readonly label: string;
}

export interface SplitMeasurement {
  readonly whole: number;
  readonly fraction: number;
}

export const FRACTION_OPTIONS: readonly FractionOption[] = [
  { value: 0, label: '0' },
  { value: 0.125, label: '⅛' },
  { value: 0.25, label: '¼' },
  { value: 0.375, label: '⅜' },
  { value: 0.5, label: '½' },
  { value: 0.625, label: '⅝' },
  { value: 0.75, label: '¾' },
  { value: 0.875, label: '⅞' },
];

export function combineMeasurement(whole: number, fraction: number): number {
  return whole + fraction;
}

export function splitMeasurement(value: number): SplitMeasurement {
  const eighths = Math.max(0, Math.round(value / MEASUREMENT_STEP));
  return {
    whole: Math.floor(eighths / 8),
    fraction: (eighths % 8) * MEASUREMENT_STEP,
  };
}

export function formatMeasurement(value: number): string {
  const { whole, fraction } = splitMeasurement(value);
  const fractionLabel = FRACTION_OPTIONS.find((option) => option.value === fraction)?.label ?? '';
  return fractionLabel && fraction > 0 ? `${whole} ${fractionLabel}"` : `${whole}"`;
}

export function adjustMeasurement(value: number, direction: 1 | -1): number {
  return Math.max(0, value + direction * MEASUREMENT_STEP);
}
