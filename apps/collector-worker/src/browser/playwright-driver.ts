import {
  classifyPageState,
  normalizeListingId,
  parseListingIdFromUrl,
  type DetailPageResult,
  type PageState,
  type RawCard,
  type RawDetail,
  type SearchCell,
  type SearchPageResult,
} from "@bai/collector-core";
import type { DetailObservedStatus } from "@bai/domain";
import type { Browser, BrowserContext, Page } from "playwright";
import { logger } from "../logger";
import type { PageDriver } from "./page-driver";

export interface PlaywrightDriverOptions {
  profileDir: string;
  headless: boolean;
  /** Base host for search/listing URLs. */
  baseUrl?: string;
  navigationTimeoutMs?: number;
}

/**
 * The LIVE headed-browser driver. Only constructed when
 * `AIRBNB_LIVE_COLLECTOR_ENABLED` is true. It is deliberately conservative and
 * NEVER attempts to defeat a source's protections:
 *
 *  - It always classifies the page first and bails to a blocking state
 *    (login/CAPTCHA/access-denied) so the collector stops for a human.
 *  - It uses the operator's persistent profile for session state — no stored
 *    credentials, no fingerprint spoofing, no proxy rotation, no rate-limit
 *    evasion, no hidden-API reverse engineering.
 *  - It runs headed by default and paces itself (the runner applies delays).
 *
 * `playwright` is imported lazily so the mock path and the built artifact never
 * require it.
 */
export class PlaywrightPageDriver implements PageDriver {
  private context: BrowserContext | undefined;
  private browser: Browser | undefined;
  private page: Page | undefined;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private readonly options: PlaywrightDriverOptions) {
    this.baseUrl = options.baseUrl ?? "https://www.airbnb.com";
    this.timeout = options.navigationTimeoutMs ?? 45000;
  }

  async launch(): Promise<void> {
    const { chromium } = await import("playwright");
    // A persistent context reuses the operator's own session state (cookies) so
    // they can log in once, in the visible window, if a page asks them to.
    this.context = await chromium.launchPersistentContext(
      this.options.profileDir,
      { headless: this.options.headless },
    );
    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    this.page.setDefaultTimeout(this.timeout);
    logger.info("collector.browser.launched", {
      headless: this.options.headless,
    });
  }

  async collectSearch(cell: SearchCell): Promise<SearchPageResult> {
    const page = this.requirePage();
    const url =
      `${this.baseUrl}/s/homes?search_by_map=true&ne_lat=${cell.north}` +
      `&ne_lng=${cell.east}&sw_lat=${cell.south}&sw_lng=${cell.west}&zoom=${cell.zoom}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const state = await this.detectState(page);
    if (state !== "ok") return { state, cards: [], malformedCount: 0 };

    const raw = await page.$$eval('a[href*="/rooms/"]', (anchors) =>
      anchors.map((a) => ({
        href: (a as HTMLAnchorElement).getAttribute("href") ?? "",
        label:
          (a as HTMLAnchorElement).getAttribute("aria-label") ??
          (a as HTMLElement).textContent ??
          "",
      })),
    );

    const seen = new Set<string>();
    const cards: RawCard[] = [];
    let malformed = 0;
    for (const item of raw) {
      const id = parseListingIdFromUrl(item.href);
      if (!id) {
        malformed += 1;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      cards.push(
        emptyCard(id, absoluteUrl(this.baseUrl, item.href), item.label),
      );
    }
    return { state: "ok", cards, malformedCount: malformed };
  }

  async collectDetail(
    listingId: string,
    url: string | null,
  ): Promise<DetailPageResult> {
    const page = this.requirePage();
    const target = url
      ? absoluteUrl(this.baseUrl, url)
      : `${this.baseUrl}/rooms/${listingId}`;
    await page.goto(target, { waitUntil: "domcontentloaded" });
    const state = await this.detectState(page);
    if (state !== "ok") {
      return { state, detail: minimalDetail(listingId, stateToDetail(state)) };
    }
    const title = await page.title().catch(() => "");
    const detail: RawDetail = {
      sourceListingId: listingId,
      observedStatus: "collected",
      description: null,
      propertyType: null,
      bedrooms: null,
      beds: null,
      bathrooms: null,
      maxGuests: null,
      amenities: [],
      hostName: null,
      sourceHostId: null,
      isSuperhost: null,
      photoUrls: [],
      rawPayload: { title },
    };
    return { state: "ok", detail };
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.context = undefined;
    this.page = undefined;
  }

  /**
   * Classify the current page. Uses the shared heuristic classifier over the
   * page HTML so a login/CAPTCHA/anti-bot page is surfaced as a blocking state
   * instead of being scraped through.
   */
  private async detectState(page: Page): Promise<PageState> {
    const html = await page.content().catch(() => "");
    const state = classifyPageState(html);
    if (state !== "ok" && state !== "no_results") {
      logger.warn("collector.page.blocked", { state, url: page.url() });
    }
    return state;
  }

  private requirePage(): Page {
    if (!this.page) throw new Error("browser not launched");
    return this.page;
  }
}

function emptyCard(id: string, url: string, label: string): RawCard {
  return {
    sourceListingId: normalizeListingId(id) ?? id,
    canonicalUrl: url,
    title: label.trim() || null,
    area: null,
    rating: null,
    reviewCount: null,
    displayedPrice: null,
    currency: null,
    guestCapacity: null,
    bedrooms: null,
    imageUrl: null,
    latitude: null,
    longitude: null,
    rawPayload: { source: "playwright" },
  };
}

function minimalDetail(
  listingId: string,
  observed: DetailObservedStatus,
): RawDetail {
  return {
    sourceListingId: listingId,
    observedStatus: observed,
    description: null,
    propertyType: null,
    bedrooms: null,
    beds: null,
    bathrooms: null,
    maxGuests: null,
    amenities: [],
    hostName: null,
    sourceHostId: null,
    isSuperhost: null,
    photoUrls: [],
    rawPayload: {},
  };
}

function stateToDetail(state: PageState): DetailObservedStatus {
  if (state === "no_results") return "unavailable";
  return "blocked";
}

function absoluteUrl(base: string, href: string): string {
  if (href.startsWith("http")) return href;
  return `${base}${href.startsWith("/") ? "" : "/"}${href}`;
}
