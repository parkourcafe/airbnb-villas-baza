/**
 * Mocked source pages for the collector. These builders emit the exact markup
 * contract that `parse.ts` understands, and are the single source of truth for
 * unit tests, the mock page driver and the end-to-end collection test. No real
 * third-party HTML is ever used.
 *
 * A page declares its state with `<meta name="bai-page-state" ...>`; blocking
 * states (login/CAPTCHA/access-denied/blocked) exist so tests can assert the
 * collector STOPS and requests manual intervention rather than pushing through.
 */

export interface FixtureCard {
  listingId: string;
  title?: string;
  area?: string;
  rating?: number;
  reviewCount?: number;
  price?: string;
  currency?: string;
  guests?: number;
  bedrooms?: number;
  lat?: number;
  lng?: number;
  image?: string;
  /** Override the canonical url; defaults to `/rooms/<listingId>`. */
  url?: string;
}

export interface FixtureDetail {
  listingId: string;
  propertyType?: string;
  description?: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  hostName?: string;
  hostId?: string;
  superhost?: boolean;
  photos?: string[];
}

function attr(
  name: string,
  value: string | number | boolean | undefined,
): string {
  if (value === undefined) return "";
  return ` ${name}="${String(value)}"`;
}

function cardHtml(card: FixtureCard): string {
  const url = card.url ?? `/rooms/${card.listingId}`;
  return `
    <article data-testid="listing-card"${attr("data-listing-id", card.listingId)}${attr(
      "data-area",
      card.area,
    )}${attr("data-rating", card.rating)}${attr("data-review-count", card.reviewCount)}${attr(
      "data-price",
      card.price,
    )}${attr("data-currency", card.currency)}${attr("data-guests", card.guests)}${attr(
      "data-bedrooms",
      card.bedrooms,
    )}${attr("data-lat", card.lat)}${attr("data-lng", card.lng)}${attr("data-image", card.image)}>
      <a class="card-link" href="${url}">${card.title ?? ""}</a>
    </article>`;
}

function page(state: string, body: string, meta = ""): string {
  return `<!doctype html>
<html>
<head><meta name="bai-page-state" content="${state}">${meta}</head>
<body>${body}</body>
</html>`;
}

/** An ordinary search-results page with the given cards. */
export function searchPageHtml(cards: readonly FixtureCard[]): string {
  const body = `<div data-testid="search-results">${cards.map(cardHtml).join("")}</div>`;
  return page("ok", body);
}

/**
 * A search page that contains a malformed card (no id, no resolvable href)
 * alongside `validCards`. The malformed card must be skipped, not crash parsing.
 */
export function malformedSearchPageHtml(
  validCards: readonly FixtureCard[] = [],
): string {
  const malformed = `
    <article data-testid="listing-card" data-area="Canggu" data-rating="4.5">
      <span>Broken card with no listing id or link</span>
    </article>`;
  const body = `<div data-testid="search-results">${malformed}${validCards
    .map(cardHtml)
    .join("")}</div>`;
  return page("ok", body);
}

export function noResultsPageHtml(): string {
  return page(
    "no_results",
    `<div data-testid="search-results"><p>No exact matches</p></div>`,
  );
}

export function listingDetailHtml(detail: FixtureDetail): string {
  const amenities = (detail.amenities ?? [])
    .map((a) => `<li>${a}</li>`)
    .join("");
  const photos = (detail.photos ?? [])
    .map((src) => `<img src="${src}" alt="">`)
    .join("");
  const body = `
    <main data-testid="listing-detail"${attr("data-listing-id", detail.listingId)}${attr(
      "data-property-type",
      detail.propertyType,
    )}${attr("data-bedrooms", detail.bedrooms)}${attr("data-beds", detail.beds)}${attr(
      "data-bathrooms",
      detail.bathrooms,
    )}${attr("data-max-guests", detail.maxGuests)}${attr("data-host-name", detail.hostName)}${attr(
      "data-host-id",
      detail.hostId,
    )}${attr("data-superhost", detail.superhost)}>
      <p data-testid="description">${detail.description ?? ""}</p>
      <ul data-testid="amenities">${amenities}</ul>
      <div data-testid="photos">${photos}</div>
    </main>`;
  return page("ok", body);
}

export function loginChallengeHtml(): string {
  return page(
    "login_challenge",
    `<div id="login">Log in or sign up to continue</div>`,
  );
}

export function captchaHtml(): string {
  return page(
    "captcha",
    `<div id="captcha">We detected unusual traffic. Verify you're a human.</div>`,
  );
}

export function accessDeniedHtml(): string {
  return page("access_denied", `<h1>Access Denied</h1><p>403 Forbidden</p>`);
}

export function blockedHtml(): string {
  return page(
    "blocked",
    `<p>You have been temporarily blocked. Too many requests.</p>`,
  );
}

/** A page a detail fetch can reference by id even when non-collectable. */
export function detailUnavailableHtml(listingId: string): string {
  return page(
    "no_results",
    `<p>This listing is not available.</p>`,
    `<meta name="bai-listing-id" content="${listingId}">`,
  );
}

/**
 * A fixture that fails the first N times it is fetched, then succeeds — used to
 * exercise bounded retry + exponential backoff for ordinary transient errors.
 */
export function transientThenOk(
  okHtml: string,
  failures: number,
): () => string {
  let remaining = failures;
  return () => {
    if (remaining > 0) {
      remaining -= 1;
      throw new Error("simulated transient navigation error");
    }
    return okHtml;
  };
}
