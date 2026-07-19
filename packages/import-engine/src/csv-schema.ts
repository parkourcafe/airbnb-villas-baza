import { ValidationError } from "@bai/domain";

/**
 * CSV import column contract (05_CODEX_IMPLEMENTATION_PLAN section 3.3).
 * The full parsing/validation pipeline is implemented in milestone 3; milestone
 * 0 fixes the header vocabulary and the required-header check so fixtures and
 * later work agree on the shape.
 */
export const CSV_COLUMNS = [
  "source_key",
  "external_id",
  "source_url",
  "title",
  "observed_at",
  "observation_status",
  "region",
  "latitude",
  "longitude",
  "rating",
  "review_count",
  "observed_price_amount",
  "observed_price_currency",
  "observed_price_unit",
  "bedrooms",
  "bathrooms",
  "guest_capacity",
  "is_superhost",
  "host_external_id",
  "official_website",
  "business_whatsapp",
  "direct_booking_url",
  "canonical_property_key",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export const REQUIRED_CSV_HEADERS = [
  "source_key",
  "external_id",
  "observed_at",
  "observation_status",
] as const satisfies readonly CsvColumn[];

/**
 * Assert that a header row contains every required column. Throws a
 * {@link ValidationError} listing what is missing. Unknown extra headers are
 * tolerated (they are ignored downstream), matching the "one bad row must not
 * fail the whole import" philosophy applied at the file level.
 */
export function assertRequiredHeaders(headers: readonly string[]): void {
  const present = new Set(headers.map((header) => header.trim()));
  const missing = REQUIRED_CSV_HEADERS.filter((header) => !present.has(header));
  if (missing.length > 0) {
    throw new ValidationError(
      `missing required CSV header(s): ${missing.join(", ")}`,
    );
  }
}
