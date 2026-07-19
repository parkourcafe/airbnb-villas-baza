/**
 * Coordinate helpers. The catalogue must never expose coordinates at a higher
 * precision than permitted (see 06_ACCEPTANCE_TESTS map/coordinate rules), so
 * coordinates are rounded before they reach the client/map.
 *
 * A degree of latitude is ~111 km, so decimal places map roughly to:
 *   3 dp ≈ 110 m, 4 dp ≈ 11 m, 5 dp ≈ 1.1 m.
 */
export const DEFAULT_COORDINATE_DECIMALS = 3;

export function roundCoordinate(
  value: number,
  decimals: number = DEFAULT_COORDINATE_DECIMALS,
): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = 10 ** Math.max(0, Math.trunc(decimals));
  return Math.round(value * factor) / factor;
}

export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** Round a lat/lng pair for safe display on a map or list. */
export function roundMapPoint(
  point: MapPoint,
  decimals: number = DEFAULT_COORDINATE_DECIMALS,
): MapPoint {
  return {
    latitude: roundCoordinate(point.latitude, decimals),
    longitude: roundCoordinate(point.longitude, decimals),
  };
}
