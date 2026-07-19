import type { DetailObservedStatus } from "@bai/domain";
import { normalizeListingId, parseListingIdFromUrl } from "./listing-id";
import type {
  DetailPageResult,
  PageState,
  RawCard,
  RawDetail,
  SearchPageResult,
} from "./types";

/**
 * Parsers for the collector's page contract. Fixtures and the mock driver use
 * this exact markup; the live Playwright adapter (behind a disabled flag) does
 * its own DOM extraction, so real, messy source HTML never flows through these
 * regexes. Keeping the parser pure makes the mock path fully unit-testable.
 *
 * A page may declare its state explicitly with
 *   <meta name="bai-page-state" content="captcha">
 * which is authoritative. Absent that, a small set of text heuristics classify
 * login/CAPTCHA/blocking/no-results pages so the live path can reuse them.
 */

const EXPLICIT_STATES: readonly PageState[] = [
  "ok",
  "no_results",
  "login_challenge",
  "captcha",
  "account_verification",
  "access_denied",
  "blocked",
  "navigation_error",
];

export function classifyPageState(html: string): PageState {
  const explicit = readMeta(html, "bai-page-state");
  if (explicit && (EXPLICIT_STATES as string[]).includes(explicit)) {
    return explicit as PageState;
  }

  const text = html.toLowerCase();
  if (
    /unusual traffic|verify you(?:'|&#39;)?re a human|are you a robot|solve the captcha/.test(
      text,
    )
  ) {
    return "captcha";
  }
  if (
    /confirm your account|verify your account|account verification/.test(text)
  ) {
    return "account_verification";
  }
  if (
    /log in or sign up|please log in|login required|sign in to continue/.test(
      text,
    )
  ) {
    return "login_challenge";
  }
  if (
    /access denied|403 forbidden|you don(?:'|&#39;)?t have permission/.test(
      text,
    )
  ) {
    return "access_denied";
  }
  if (/temporarily blocked|too many requests|rate limit|429/.test(text)) {
    return "blocked";
  }
  if (/no exact matches|no results found|0 results/.test(text)) {
    return "no_results";
  }
  return "ok";
}

/** Parse a search-results page into cards, skipping malformed ones. */
export function parseSearchHtml(html: string): SearchPageResult {
  const state = classifyPageState(html);
  if (state !== "ok" && state !== "no_results") {
    return { state, cards: [], malformedCount: 0 };
  }

  const cards: RawCard[] = [];
  let malformed = 0;
  for (const block of matchAll(html, CARD_RE)) {
    const openTag = block[1];
    if (openTag == null) continue;
    const card = parseCard(openTag, block[2] ?? "");
    if (card) cards.push(card);
    else malformed += 1;
  }

  const resolved: PageState =
    state === "ok" && cards.length === 0 && malformed === 0
      ? "no_results"
      : state;
  return { state: resolved, cards, malformedCount: malformed };
}

/** Parse a single listing detail page. */
export function parseDetailHtml(html: string): DetailPageResult {
  const state = classifyPageState(html);
  const observed = detailStatusForState(state);
  if (state !== "ok") {
    return { state, detail: nonCollectedDetail(html, observed) };
  }

  const block = matchOne(html, DETAIL_RE);
  const openTag = block?.[1];
  if (!block || openTag == null) {
    return { state: "ok", detail: null };
  }
  const inner = block[2] ?? "";

  const id =
    normalizeListingId(attr(openTag, "data-listing-id")) ??
    parseListingIdFromUrl(attr(openTag, "data-canonical-url"));
  if (!id) {
    return { state: "ok", detail: null };
  }

  const detail: RawDetail = {
    sourceListingId: id,
    observedStatus: "collected",
    description: text(matchOne(inner, DESCRIPTION_RE)?.[1]) ?? null,
    propertyType: attr(openTag, "data-property-type"),
    bedrooms: num(attr(openTag, "data-bedrooms")),
    beds: num(attr(openTag, "data-beds")),
    bathrooms: num(attr(openTag, "data-bathrooms")),
    maxGuests: num(attr(openTag, "data-max-guests")),
    amenities: parseList(inner, AMENITIES_RE, LIST_ITEM_RE),
    hostName: attr(openTag, "data-host-name"),
    sourceHostId: attr(openTag, "data-host-id"),
    isSuperhost: bool(attr(openTag, "data-superhost")),
    photoUrls: parseAttrs(inner, PHOTOS_RE, IMG_SRC_RE),
    rawPayload: { openTag, kind: "detail" },
  };
  return { state: "ok", detail };
}

// --- markup contract -------------------------------------------------------

const CARD_RE =
  /<article\b([^>]*\bdata-testid="listing-card"[^>]*)>([\s\S]*?)<\/article>/gi;
const DETAIL_RE =
  /<main\b([^>]*\bdata-testid="listing-detail"[^>]*)>([\s\S]*?)<\/main>/i;
const HREF_RE = /href="([^"]*)"/i;
const TITLE_RE = /<a\b[^>]*>([\s\S]*?)<\/a>/i;
const DESCRIPTION_RE = /data-testid="description"[^>]*>([\s\S]*?)</i;
const AMENITIES_RE = /data-testid="amenities"[^>]*>([\s\S]*?)<\/ul>/i;
const PHOTOS_RE = /data-testid="photos"[^>]*>([\s\S]*?)<\/div>/i;
const LIST_ITEM_RE = /<li[^>]*>([\s\S]*?)<\/li>/gi;
const IMG_SRC_RE = /<img[^>]*\bsrc="([^"]*)"/gi;

function parseCard(openTag: string, inner: string): RawCard | null {
  const href =
    matchOne(inner, HREF_RE)?.[1] ?? attr(openTag, "data-canonical-url");
  const id =
    normalizeListingId(attr(openTag, "data-listing-id")) ??
    parseListingIdFromUrl(href);
  if (!id) return null;

  return {
    sourceListingId: id,
    canonicalUrl: href ?? null,
    title: text(matchOne(inner, TITLE_RE)?.[1]) ?? attr(openTag, "data-title"),
    area: attr(openTag, "data-area"),
    rating: num(attr(openTag, "data-rating")),
    reviewCount: int(attr(openTag, "data-review-count")),
    displayedPrice: attr(openTag, "data-price"),
    currency: attr(openTag, "data-currency"),
    guestCapacity: int(attr(openTag, "data-guests")),
    bedrooms: int(attr(openTag, "data-bedrooms")),
    imageUrl: attr(openTag, "data-image"),
    latitude: num(attr(openTag, "data-lat")),
    longitude: num(attr(openTag, "data-lng")),
    rawPayload: { openTag, kind: "card" },
  };
}

function detailStatusForState(state: PageState): DetailObservedStatus {
  switch (state) {
    case "ok":
      return "collected";
    case "no_results":
      return "unavailable";
    case "blocked":
    case "access_denied":
    case "captcha":
    case "login_challenge":
    case "account_verification":
      return "blocked";
    default:
      return "error";
  }
}

function nonCollectedDetail(
  html: string,
  observed: DetailObservedStatus,
): RawDetail | null {
  const id =
    normalizeListingId(readMeta(html, "bai-listing-id")) ??
    parseListingIdFromUrl(readMeta(html, "bai-canonical-url"));
  if (!id) return null;
  return {
    sourceListingId: id,
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
    rawPayload: { kind: "detail", observed },
  };
}

// --- small parsing helpers -------------------------------------------------

function readMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]*)"`, "i");
  return matchOne(html, re)?.[1]?.trim() ?? null;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
  const value = matchOne(tag, re)?.[1];
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseList(html: string, blockRe: RegExp, itemRe: RegExp): string[] {
  const block = matchOne(html, blockRe)?.[1];
  if (!block) return [];
  const items: string[] = [];
  for (const m of matchAll(block, itemRe)) {
    const value = text(m[1]);
    if (value) items.push(value);
  }
  return items;
}

function parseAttrs(html: string, blockRe: RegExp, itemRe: RegExp): string[] {
  const block = matchOne(html, blockRe)?.[1];
  if (!block) return [];
  const items: string[] = [];
  for (const m of matchAll(block, itemRe)) {
    if (m[1]) items.push(m[1]);
  }
  return items;
}

function matchOne(input: string, re: RegExp): RegExpMatchArray | null {
  return input.match(re);
}

function* matchAll(input: string, re: RegExp): Generator<RegExpMatchArray> {
  const global = new RegExp(
    re.source,
    re.flags.includes("g") ? re.flags : `${re.flags}g`,
  );
  let match: RegExpExecArray | null;
  while ((match = global.exec(input)) !== null) {
    yield match;
    if (match.index === global.lastIndex) global.lastIndex += 1;
  }
}

function text(value: string | null | undefined): string | null {
  if (value == null) return null;
  const stripped = value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

function num(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: string | null | undefined): number | null {
  const parsed = num(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function bool(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  if (/^(true|1|yes)$/i.test(value)) return true;
  if (/^(false|0|no)$/i.test(value)) return false;
  return null;
}
