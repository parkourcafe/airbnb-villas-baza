/**
 * Versioned materiality configuration (04 §10). Materiality decides whether a
 * stored diff is significant enough to become a visible event. Every diff and
 * event records the `version` so a later tuning of thresholds never silently
 * rewrites how past changes were judged (04 §13).
 */
export interface MaterialityConfig {
  /** Rule version tag stored on every diff produced under this config. */
  version: string;
  /** Minimum fractional price change to be material, e.g. 0.05 = 5% (04 §10.1). */
  pricePercentThreshold: number;
  /** Optional absolute price delta (same currency) that is always material. */
  priceAbsoluteThreshold?: number;
  /** Minimum rating change to be material, e.g. 0.05 (04 §10.2). */
  ratingThreshold: number;
  /** Minimum review-count increase to raise a visible event (04 §10.3). */
  reviewCountThreshold: number;
}

export const DEFAULT_MATERIALITY: MaterialityConfig = {
  version: "field-diff:v1",
  pricePercentThreshold: 0.05,
  ratingThreshold: 0.05,
  reviewCountThreshold: 1,
};

/**
 * Merge overrides onto the default config, producing a new versioned config.
 * A caller supplying overrides must also supply a distinct `version` so the
 * provenance of a diff stays unambiguous.
 */
export function resolveMateriality(
  overrides?: Partial<MaterialityConfig>,
): MaterialityConfig {
  if (!overrides) return DEFAULT_MATERIALITY;
  return { ...DEFAULT_MATERIALITY, ...overrides };
}
