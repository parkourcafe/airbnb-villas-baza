import type { DetailObservedStatus, ManualActionReason } from "@bai/domain";

/**
 * The state a fetched page resolved to. The collector NEVER attempts to defeat a
 * source's security controls: `login_challenge`, `captcha`, `access_denied` and
 * `blocked` all stop the job and request manual intervention.
 */
export type PageState =
  | "ok"
  | "no_results"
  | "login_challenge"
  | "captcha"
  | "account_verification"
  | "access_denied"
  | "blocked"
  | "navigation_error";

/** Page states that require a human before the job can continue. */
export const MANUAL_ACTION_PAGE_STATES: readonly PageState[] = [
  "login_challenge",
  "captcha",
  "account_verification",
  "access_denied",
  "blocked",
];

/** Map a blocking page state to its manual-action reason, or null if not blocking. */
export function manualActionReasonForState(
  state: PageState,
): ManualActionReason | null {
  switch (state) {
    case "login_challenge":
      return "login_challenge";
    case "captcha":
      return "captcha";
    case "account_verification":
      return "account_verification";
    case "access_denied":
      return "access_denied";
    case "blocked":
      return "blocking_page";
    case "navigation_error":
      return "navigation_failure";
    default:
      return null;
  }
}

/**
 * A single listing card extracted from a search-results page. All identifiers
 * are text. The title is NEVER used as an identifier — `sourceListingId` is the
 * parsed listing id from the canonical URL / page metadata.
 */
export interface RawCard {
  sourceListingId: string;
  canonicalUrl: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  reviewCount: number | null;
  displayedPrice: string | null;
  currency: string | null;
  guestCapacity: number | null;
  bedrooms: number | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  rawPayload: Record<string, unknown>;
}

/** Structured fields extracted from a single listing detail page. */
export interface RawDetail {
  sourceListingId: string;
  observedStatus: DetailObservedStatus;
  description: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  amenities: string[];
  hostName: string | null;
  sourceHostId: string | null;
  isSuperhost: boolean | null;
  photoUrls: string[];
  rawPayload: Record<string, unknown>;
}

export interface SearchPageResult {
  state: PageState;
  cards: RawCard[];
  /** Cards present on the page that could not be parsed to a usable identifier. */
  malformedCount: number;
}

export interface DetailPageResult {
  state: PageState;
  detail: RawDetail | null;
}
