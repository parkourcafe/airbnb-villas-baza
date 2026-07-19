/**
 * Canonical BAI enumerations.
 *
 * Each enum is expressed as a readonly tuple so it can be reused for both
 * compile-time union types and runtime validation (e.g. Zod `z.enum`).
 * These are source-agnostic and carry no database or network dependency.
 */

export const OBSERVATION_STATUS = [
  "active",
  "unavailable",
  "not_found",
  "search_not_observed",
  "blocked",
  "source_error",
  "unknown",
] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUS)[number];

/**
 * Statuses that represent a source failure rather than a real signal about the
 * listing. These must never increment lifecycle misses (see AGENTS.md).
 */
export const SOURCE_FAILURE_STATUSES: readonly ObservationStatus[] = [
  "blocked",
  "source_error",
];

/**
 * Absence in a search result is not the same as a direct "not found". Search
 * absence must never, on its own, drive an inactivity transition.
 */
export const SEARCH_ABSENCE_STATUSES: readonly ObservationStatus[] = [
  "search_not_observed",
];

export const LIFECYCLE_STATUS = [
  "active",
  "first_miss",
  "suspected_inactive",
  "confirmed_inactive",
  "reactivated",
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUS)[number];

export const SOURCE_COMPLIANCE_STATUS = [
  "approved",
  "restricted",
  "pending_review",
  "disabled",
] as const;
export type SourceComplianceStatus = (typeof SOURCE_COMPLIANCE_STATUS)[number];

export const SOURCE_ACCESS_MODE = [
  "owner_supplied",
  "licensed_api",
  "public_registry",
  "manual_import",
  "browser_automation",
  "demo_fixture",
] as const;
export type SourceAccessMode = (typeof SOURCE_ACCESS_MODE)[number];

export const SOURCE_CAPABILITY = [
  "listing_identity",
  "listing_status",
  "search_presence",
  "title",
  "rating",
  "review_count",
  "price",
  "location",
  "host_identity",
  "direct_channels",
  "amenities",
  "content_fingerprint",
] as const;
export type SourceCapability = (typeof SOURCE_CAPABILITY)[number];

export const COVERAGE_MODE = ["full_market", "targeted_listing_check"] as const;
export type CoverageMode = (typeof COVERAGE_MODE)[number];

export const CONFIDENCE = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const PRICE_UNIT = ["night", "stay", "unknown"] as const;
export type PriceUnit = (typeof PRICE_UNIT)[number];

/**
 * MVP event types. Lifecycle events are evidence-backed and observation
 * language is used everywhere: nothing here claims a legal cause or a removal.
 */
export const EVENT_TYPE = [
  "listing_created",
  "price_changed",
  "rating_changed",
  "review_count_changed",
  "host_changed",
  "direct_channel_added",
  "first_miss",
  "suspected_inactive",
  "confirmed_inactive",
  "reactivated",
  "source_error_observed",
] as const;
export type EventType = (typeof EVENT_TYPE)[number];

/**
 * Data-quality flags surfaced on records and runs (see 02_SYSTEM_ARCHITECTURE
 * section 16). Never used to make a legal conclusion.
 */
export const DATA_QUALITY_FLAG = [
  "missing_external_id",
  "invalid_url",
  "invalid_coordinates",
  "coordinates_outside_bali",
  "rating_out_of_range",
  "negative_review_count",
  "unknown_currency",
  "duplicate_row",
  "parser_version_mismatch",
  "coverage_drop",
  "source_error_spike",
  "unusually_large_change",
  "entity_resolution_conflict",
] as const;
export type DataQualityFlag = (typeof DATA_QUALITY_FLAG)[number];
