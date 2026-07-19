import type { SearchCell } from "@bai/collector-core";
import type { DetailPageResult, SearchPageResult } from "@bai/collector-core";

/**
 * The collector's browser abstraction. A driver knows how to fetch a search
 * cell and a listing detail page and return the SAME structured results the
 * pure parser produces. Two implementations exist:
 *
 *  - `MockPageDriver` — deterministic, fixture-backed, no network (tests/dry-run).
 *  - `PlaywrightPageDriver` — a VISIBLE headed browser, only when the live flag
 *    is enabled. It never tries to defeat security controls: login/CAPTCHA/
 *    blocking pages are reported as blocking states for a human to resolve.
 */
export interface PageDriver {
  /** Open the visible browser / prepare state. */
  launch(): Promise<void>;
  /** Fetch one search cell's results. */
  collectSearch(cell: SearchCell): Promise<SearchPageResult>;
  /** Fetch one listing detail page by its canonical url (or listing id). */
  collectDetail(
    listingId: string,
    url: string | null,
  ): Promise<DetailPageResult>;
  /** Close the browser / release resources. */
  close(): Promise<void>;
}
