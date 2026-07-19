/**
 * Geographic coverage window used to sanity-check imported coordinates. Values
 * are approximate and configurable per source/dataset; the default is a generous
 * bounding box around Bali.
 */
export interface ImportCoverage {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export const BALI_COVERAGE: ImportCoverage = {
  latMin: -9.2,
  latMax: -8.0,
  lngMin: 114.4,
  lngMax: 115.8,
};

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isWithinCoverage(
  latitude: number,
  longitude: number,
  coverage: ImportCoverage,
): boolean {
  return (
    latitude >= coverage.latMin &&
    latitude <= coverage.latMax &&
    longitude >= coverage.lngMin &&
    longitude <= coverage.lngMax
  );
}
