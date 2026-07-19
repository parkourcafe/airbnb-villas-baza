/**
 * `@bai/collector-core` — pure logic for browser-operated collection.
 *
 * Market/area definitions, search-cell planning, HTML card/detail parsing,
 * listing-id parsing, deduplication and snapshot integrity. No browser, network
 * or database dependency, so it is safe to import from the web app, the local
 * collector worker and unit tests alike. The collector never tries to defeat a
 * source's security controls — blocking page states surface as manual-action
 * reasons for a human to resolve.
 */
export type { BoundingBox, MarketArea, MarketDefinition } from "./market";
export { BALI_MARKET, MARKETS, getMarket, getMarketArea } from "./market";
export type { PlannerOptions, SearchCell } from "./planner";
export {
  planAreaCells,
  planMarketCells,
  subdivideBoundingBox,
} from "./planner";
export { normalizeListingId, parseListingIdFromUrl } from "./listing-id";
export type {
  DetailPageResult,
  PageState,
  RawCard,
  RawDetail,
  SearchPageResult,
} from "./types";
export { MANUAL_ACTION_PAGE_STATES, manualActionReasonForState } from "./types";
export { classifyPageState, parseDetailHtml, parseSearchHtml } from "./parse";
export type { CardDiscovery, DedupedListing, DedupeResult } from "./dedupe";
export { dedupeDiscoveries } from "./dedupe";
export type { SnapshotCoverageInput } from "./snapshot";
export {
  completionPercentage,
  computeSnapshotChecksum,
  computeSnapshotChecksumFromCards,
  deriveQualityStatus,
  searchCellCoverage,
  snapshotListingFingerprint,
} from "./snapshot";
