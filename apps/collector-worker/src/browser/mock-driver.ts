import {
  parseDetailHtml,
  parseSearchHtml,
  type DetailPageResult,
  type SearchCell,
  type SearchPageResult,
} from "@bai/collector-core";
import type { PageDriver } from "./page-driver";

export interface MockDriverOptions {
  /** Search-results HTML returned per cell, consumed in call order. */
  searchPages: string[];
  /** Detail HTML by listing id (string) or a thunk (to simulate transient errors). */
  detailPages: Record<string, string | (() => string)>;
  /**
   * Listing ids whose detail fetch should report a blocking state (login/CAPTCHA)
   * so the collector STOPS and requests manual intervention. Mutable so a test
   * can clear it before resuming (simulating the operator resolving the block).
   */
  blockedDetailIds?: Set<string>;
  /** HTML to serve for a blocked detail page (defaults to a login challenge). */
  blockedDetailHtml?: string;
}

/**
 * A deterministic, fixture-backed page driver. No network access ever occurs.
 * It runs the real parser over fixture HTML so the mock path exercises the exact
 * parsing/classification logic the live path relies on.
 */
export class MockPageDriver implements PageDriver {
  private searchIndex = 0;
  private readonly options: MockDriverOptions;

  constructor(options: MockDriverOptions) {
    this.options = options;
  }

  async launch(): Promise<void> {
    /* no-op for the mock */
  }

  async collectSearch(_cell: SearchCell): Promise<SearchPageResult> {
    const html = this.options.searchPages[this.searchIndex] ?? "";
    this.searchIndex += 1;
    return parseSearchHtml(html);
  }

  async collectDetail(
    listingId: string,
    _url: string | null,
  ): Promise<DetailPageResult> {
    if (this.options.blockedDetailIds?.has(listingId)) {
      const blockedHtml =
        this.options.blockedDetailHtml ??
        `<html><head><meta name="bai-page-state" content="login_challenge"></head><body>Log in or sign up</body></html>`;
      return parseDetailHtml(blockedHtml);
    }
    const entry = this.options.detailPages[listingId];
    if (entry == null) {
      // Unknown listing → treat as an unavailable detail page (not an error).
      return parseDetailHtml(
        `<html><head><meta name="bai-page-state" content="no_results"><meta name="bai-listing-id" content="${listingId}"></head><body>unavailable</body></html>`,
      );
    }
    const html = typeof entry === "function" ? entry() : entry;
    return parseDetailHtml(html);
  }

  async close(): Promise<void> {
    /* no-op for the mock */
  }
}
