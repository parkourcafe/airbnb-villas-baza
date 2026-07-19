import { createHash } from "node:crypto";

/**
 * Deterministic text normalization used before hashing noisy fields
 * (title/description/amenities). See 02_SYSTEM_ARCHITECTURE section 10.2.
 *
 * Steps: Unicode NFC normalize, trim, and collapse internal whitespace runs to a
 * single space. Case is preserved here; callers lower-case only where case is
 * not meaningful. Timestamps and session data must never be passed in.
 */
export function normalizeText(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Stable SHA-256 hex hash of already-normalized content. Returned as lower-case
 * hex so fingerprints are reproducible across runs and machines.
 */
export function contentHash(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Convenience: normalize then hash. */
export function normalizedHash(input: string): string {
  return contentHash(normalizeText(input));
}

/**
 * Query parameters that carry tracking/session state, not listing identity.
 * They are dropped during URL normalization so a re-shared link does not read
 * as a changed direct channel (04 §10.9). Matched case-insensitively; any
 * `utm_*` parameter is also dropped.
 */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "yclid",
  "_ga",
  "ref",
  "ref_src",
  "source",
  "s",
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

/**
 * Canonicalize an http(s) URL so equivalent links compare equal:
 * lower-case scheme + host, default ports removed, tracking/session query
 * params stripped, remaining params sorted, fragment removed, and a trailing
 * slash removed from non-root paths. Returns `null` for anything that is not a
 * syntactically valid http/https URL (callers treat that as "no value").
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  const kept: [string, string][] = [];
  for (const [key, value] of url.searchParams) {
    if (!isTrackingParam(key)) kept.push([key, value]);
  }
  kept.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Parse a loosely-typed boolean token. Returns `null` when the token is not a
 * recognized truthy/falsy value, so callers can distinguish "unparseable" from
 * a real `false`.
 */
export function parseBoolean(input: string): boolean | null {
  const v = input.trim().toLowerCase();
  if (v === "") return null;
  if (["true", "1", "yes", "y", "t"].includes(v)) return true;
  if (["false", "0", "no", "n", "f"].includes(v)) return false;
  return null;
}

/**
 * Parse a decimal number, tolerating surrounding whitespace and thousands
 * separators (commas). Returns `null` for anything that is not a finite number
 * so a bad value never silently becomes 0.
 */
export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Normalize a set-valued field (e.g. amenities) into a canonical, de-duplicated,
 * sorted list. Each item is NFC-normalized, whitespace-collapsed and
 * lower-cased so case- and spacing-only churn never reads as a real change
 * (04 §10.7). Empty items are dropped.
 */
export function normalizeSet(items: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of items) {
    const value = normalizeText(raw).toLowerCase();
    if (value !== "") seen.add(value);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Stable hash of a set-valued field. The set is normalized first, so the hash
 * is invariant to ordering, duplicates, case and whitespace.
 */
export function setHash(items: readonly string[]): string {
  return contentHash(normalizeSet(items).join("\n"));
}

/** The added/removed members between two set-valued observations. */
export interface SetDelta {
  added: string[];
  removed: string[];
}

/** Compute the added/removed members going from `previous` to `current`. */
export function setDelta(
  previous: readonly string[],
  current: readonly string[],
): SetDelta {
  const prev = new Set(normalizeSet(previous));
  const curr = new Set(normalizeSet(current));
  const added = [...curr].filter((x) => !prev.has(x));
  const removed = [...prev].filter((x) => !curr.has(x));
  return { added, removed };
}
