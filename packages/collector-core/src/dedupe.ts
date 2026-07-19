import type { RawCard } from "./types";

export interface CardDiscovery {
  card: RawCard;
  /** Identifier of the search cell this discovery came from. */
  cellId: string;
}

export interface DedupedListing {
  card: RawCard;
  /** Every cell the listing was discovered in (deduplicated, in first-seen order). */
  discoveryCellIds: string[];
  /** Number of raw discoveries that mapped to this listing. */
  discoveryCount: number;
}

export interface DedupeResult {
  unique: DedupedListing[];
  uniqueCount: number;
  /** Discoveries beyond the first for each listing (the "duplicate discoveries" metric). */
  duplicateCount: number;
  totalDiscoveries: number;
}

/**
 * Deduplicate discovered cards by source listing id. A listing found in several
 * cells is represented once but retains all its discovery-cell associations.
 * Non-null fields from later discoveries fill gaps left by the first, so a card
 * that was sparse in one cell can be completed by another.
 */
export function dedupeDiscoveries(
  discoveries: readonly CardDiscovery[],
): DedupeResult {
  const byId = new Map<string, DedupedListing>();

  for (const { card, cellId } of discoveries) {
    const existing = byId.get(card.sourceListingId);
    if (!existing) {
      byId.set(card.sourceListingId, {
        card: { ...card },
        discoveryCellIds: [cellId],
        discoveryCount: 1,
      });
      continue;
    }
    existing.discoveryCount += 1;
    if (!existing.discoveryCellIds.includes(cellId)) {
      existing.discoveryCellIds.push(cellId);
    }
    existing.card = mergeCards(existing.card, card);
  }

  const unique = [...byId.values()];
  const totalDiscoveries = discoveries.length;
  return {
    unique,
    uniqueCount: unique.length,
    duplicateCount: totalDiscoveries - unique.length,
    totalDiscoveries,
  };
}

/** Fill null/empty fields of `base` from `next`; `base` values win when present. */
function mergeCards(base: RawCard, next: RawCard): RawCard {
  const merged: RawCard = { ...base };
  for (const key of Object.keys(next) as (keyof RawCard)[]) {
    if (key === "rawPayload") continue;
    if (isEmpty(merged[key]) && !isEmpty(next[key])) {
      // Field-by-field fill; types line up because we copy the same key.
      (merged as Record<keyof RawCard, unknown>)[key] = next[key];
    }
  }
  return merged;
}

function isEmpty(value: unknown): boolean {
  return value == null || value === "";
}
