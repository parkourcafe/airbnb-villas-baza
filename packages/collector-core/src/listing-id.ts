/**
 * Parse the stable source listing id from a canonical listing URL. The listing
 * id — never the displayed title — is the identifier. Ids are kept as text.
 *
 * Handles the common shapes:
 *   https://www.airbnb.com/rooms/12345
 *   https://www.airbnb.com/rooms/plus/12345
 *   https://www.airbnb.co.id/rooms/12345?source_impression_id=...
 *   /rooms/12345
 */
export function parseListingIdFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Match `/rooms/<optional segment>/<digits>` allowing an optional
  // non-numeric segment (e.g. `plus`, `luxury`) before the numeric id.
  const match = trimmed.match(/\/rooms\/(?:[a-z0-9_-]+\/)?(\d+)(?:[/?#]|$)/i);
  if (match) return match[1] ?? null;

  // Fall back to an explicit id query param some listing links carry.
  const idParam = trimmed.match(/[?&](?:listing_id|room_id|id)=(\d+)/i);
  if (idParam) return idParam[1] ?? null;

  return null;
}

/**
 * Normalize a listing id to canonical text form. Returns null for empty/blank
 * input so callers can reject cards without a usable identifier.
 */
export function normalizeListingId(
  id: string | null | undefined,
): string | null {
  if (id == null) return null;
  const trimmed = String(id).trim();
  return trimmed.length > 0 ? trimmed : null;
}
