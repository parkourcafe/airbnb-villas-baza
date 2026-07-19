/**
 * `@bai/import-engine` - CSV import pipeline.
 *
 * Milestone 3 provides the full parse/validate/deduplicate core (pure and
 * streaming-friendly): the CSV column contract, per-row validation with reason
 * codes, deduplication, file checksum for idempotency, and result aggregation.
 * The async worker (M3) and snapshot engine (M4) consume `ParsedImportRow`.
 */
export * from "./csv-schema";
export * from "./rejection";
export * from "./coverage";
export * from "./validate";
export * from "./process";
