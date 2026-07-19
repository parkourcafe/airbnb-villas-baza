import { describe, expect, it } from "vitest";
import { dedupeDiscoveries, type CardDiscovery } from "./dedupe";
import type { RawCard } from "./types";

function card(id: string, over: Partial<RawCard> = {}): RawCard {
  return {
    sourceListingId: id,
    canonicalUrl: `/rooms/${id}`,
    title: `Listing ${id}`,
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
    rawPayload: {},
    ...over,
  };
}

describe("dedupeDiscoveries", () => {
  it("collapses a listing found in two cells to one, retaining both cells", () => {
    const discoveries: CardDiscovery[] = [
      { card: card("1"), cellId: "cellA" },
      { card: card("2"), cellId: "cellA" },
      { card: card("1"), cellId: "cellB" },
    ];
    const result = dedupeDiscoveries(discoveries);
    expect(result.uniqueCount).toBe(2);
    expect(result.totalDiscoveries).toBe(3);
    expect(result.duplicateCount).toBe(1);
    const listing1 = result.unique.find((u) => u.card.sourceListingId === "1");
    expect(listing1?.discoveryCellIds).toEqual(["cellA", "cellB"]);
    expect(listing1?.discoveryCount).toBe(2);
  });

  it("fills gaps from later discoveries without overwriting present fields", () => {
    const discoveries: CardDiscovery[] = [
      { card: card("1", { rating: 4.9, reviewCount: null }), cellId: "a" },
      { card: card("1", { rating: 4.1, reviewCount: 50 }), cellId: "b" },
    ];
    const listing = dedupeDiscoveries(discoveries).unique[0]!;
    expect(listing.card.rating).toBe(4.9); // first present value wins
    expect(listing.card.reviewCount).toBe(50); // gap filled from second
  });

  it("computes the 12 -> 10 dedup example", () => {
    // Two overlapping cells: cellA has 1..7, cellB has 5..10 (5,6,7 overlap).
    const discoveries: CardDiscovery[] = [];
    for (let i = 1; i <= 7; i += 1)
      discoveries.push({ card: card(String(i)), cellId: "cellA" });
    for (let i = 5; i <= 10; i += 1)
      discoveries.push({ card: card(String(i)), cellId: "cellB" });
    const result = dedupeDiscoveries(discoveries);
    expect(result.totalDiscoveries).toBe(13);
    expect(result.uniqueCount).toBe(10);
  });
});
