import type { PriceUnit } from "./enums";

/**
 * Money is stored as an exact decimal string plus an ISO-4217 currency code so
 * no floating point rounding is ever introduced. Amounts are compared only when
 * both currency and unit match (see snapshot comparability rules).
 */
export interface Money {
  /** Exact decimal amount, e.g. "3500000" or "129.90". */
  amount: string;
  /** Upper-case ISO-4217 currency code, e.g. "IDR". */
  currency: string;
  /** Billing unit of the observed price. */
  unit: PriceUnit;
}

/**
 * Two observed prices are comparable only when currency and unit are identical.
 * Incompatible observations must not produce a price-change event.
 */
export function isComparablePrice(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.unit === b.unit;
}
