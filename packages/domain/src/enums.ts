/**
 * Canonical BAI enumerations.
 *
 * Each enum is expressed as a readonly tuple so it can be reused for both
 * compile-time union types and runtime validation (e.g. Zod `z.enum`).
 * These are source-agnostic and carry no database or network dependency.
 */

export const MEMBER_ROLE = ["owner", "admin", "analyst", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

export const DATASET_STATUS = ["active", "paused", "archived"] as const;
export type DatasetStatus = (typeof DATASET_STATUS)[number];

export const ACCESS_LEVEL = ["read", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVEL)[number];

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

export const COLLECTION_RUN_STATUS = [
  "pending",
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "degraded",
  "failed",
  "cancelled",
] as const;
export type CollectionRunStatus = (typeof COLLECTION_RUN_STATUS)[number];

export const JOB_STATUS = [
  "queued",
  "running",
  "retry_wait",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const JOB_TYPE = [
  "import",
  "collect",
  "normalize",
  "compare",
  "report",
  "export",
  "notify",
  "maintenance",
] as const;
export type JobType = (typeof JOB_TYPE)[number];

/**
 * Browser-operated collection (Milestone 11). A user starts a collection job
 * from the dashboard; a local worker on their own machine claims and runs it in
 * a visible browser. The worker STOPS on any login/CAPTCHA/blocking page and
 * surfaces `manual_action_required` — it never attempts to defeat a source's
 * security controls.
 */
export const COLLECTION_JOB_STATE = [
  "draft",
  "queued",
  "claimed",
  "running",
  "manual_action_required",
  "paused",
  "completing",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;
export type CollectionJobState = (typeof COLLECTION_JOB_STATE)[number];

/** Terminal states after which a collection job does no further work. */
export const COLLECTION_TERMINAL_STATES: readonly CollectionJobState[] = [
  "completed",
  "partial",
  "failed",
  "cancelled",
];

export const COLLECTION_MODE = [
  "search_results_only",
  "search_and_details",
  "verify_existing_listings",
] as const;
export type CollectionMode = (typeof COLLECTION_MODE)[number];

export const SEARCH_CELL_STATUS = [
  "pending",
  "running",
  "completed",
  "manual_action_required",
  "failed",
  "skipped",
] as const;
export type SearchCellStatus = (typeof SEARCH_CELL_STATUS)[number];

/**
 * Why a collection stopped and asked the operator to intervene. The collector
 * never bypasses these — it surfaces the reason and waits for a human.
 */
export const MANUAL_ACTION_REASON = [
  "captcha",
  "login_challenge",
  "account_verification",
  "access_denied",
  "blocking_page",
  "navigation_failure",
] as const;
export type ManualActionReason = (typeof MANUAL_ACTION_REASON)[number];

/**
 * Quality of a finalized market snapshot. A `degraded` snapshot must never be
 * compared automatically without explicit user confirmation.
 */
export const SNAPSHOT_QUALITY_STATUS = [
  "complete",
  "partial",
  "degraded",
  "failed",
] as const;
export type SnapshotQualityStatus = (typeof SNAPSHOT_QUALITY_STATUS)[number];

/**
 * Per-listing verification outcome for `verify_existing_listings`. One failed
 * observation (login_required/blocked/source_error/unknown) must never, on its
 * own, be interpreted as a removed listing.
 */
export const LISTING_VERIFICATION_STATUS = [
  "active",
  "unavailable",
  "not_found",
  "login_required",
  "blocked",
  "source_error",
  "unknown",
] as const;
export type ListingVerificationStatus =
  (typeof LISTING_VERIFICATION_STATUS)[number];

/** Verification outcomes that are NOT evidence a listing is gone. */
export const VERIFICATION_INCONCLUSIVE_STATUSES: readonly ListingVerificationStatus[] =
  ["login_required", "blocked", "source_error", "unknown"];

/** Observed status of a single detail-enrichment page fetch. */
export const DETAIL_OBSERVED_STATUS = [
  "collected",
  "unavailable",
  "not_found",
  "blocked",
  "error",
  "skipped",
] as const;
export type DetailObservedStatus = (typeof DETAIL_OBSERVED_STATUS)[number];
