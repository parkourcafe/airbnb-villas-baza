import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  listingDetailHtml,
  searchPageHtml,
  type FixtureCard,
} from "@bai/collector-core/fixtures";
import { MockPageDriver } from "../src/browser/mock-driver";
import { InMemoryCollectorStore } from "../src/store/in-memory-store";
import type { CollectionRecord } from "../src/store/store";
import { runCollection } from "../src/runner/collect";

const noopSleep = async () => {};
const pacing = { actionDelayMs: 0, retryLimit: 2, sleep: noopSleep };
const clock = () => "2026-07-19T00:00:00.000Z";

function card(id: string, over: Partial<FixtureCard> = {}): FixtureCard {
  return {
    listingId: id,
    title: `Villa ${id}`,
    area: "Bingin",
    rating: 4.8,
    reviewCount: 100,
    ...over,
  };
}

/** Two overlapping cells: A has 1..7, B has 6..10 → 12 discoveries, 10 unique. */
function twoOverlappingCells(): string[] {
  const cellA = [1, 2, 3, 4, 5, 6, 7].map((n) => card(String(n)));
  const cellB = [6, 7, 8, 9, 10].map((n) =>
    card(String(n), { area: "Balangan" }),
  );
  return [searchPageHtml(cellA), searchPageHtml(cellB)];
}

function detailPages(): Record<string, string> {
  const pages: Record<string, string> = {};
  for (let n = 1; n <= 10; n += 1) {
    pages[String(n)] = listingDetailHtml({
      listingId: String(n),
      propertyType: "Villa",
      description: `Detail for villa ${n}`,
      bedrooms: 3,
      beds: 4,
      bathrooms: 3,
      maxGuests: 6,
      amenities: ["Pool", "Wifi"],
      hostName: `Host ${n}`,
      hostId: `host-${n}`,
      superhost: true,
      photos: [`https://img/${n}-1.jpg`],
    });
  }
  return pages;
}

function seedCollection(
  store: InMemoryCollectorStore,
  over: Partial<CollectionRecord> = {},
): CollectionRecord {
  const record: CollectionRecord = {
    id: randomUUID(),
    organizationId: randomUUID(),
    datasetId: randomUUID(),
    sourceId: randomUUID(),
    sourceKey: "airbnb",
    market: "bali",
    mode: "search_and_details",
    state: "queued",
    headed: true,
    collectDetails: true,
    maxListings: null,
    minRating: null,
    minReviewCount: null,
    selectedAreas: ["bingin", "balangan"],
    sourceSnapshotId: null,
    ...over,
  };
  store.seedCollection(record);
  return record;
}

describe("browser collection end-to-end (mocked)", () => {
  it("collects, dedupes, enriches, produces a partial snapshot, then resumes to complete", async () => {
    const store = new InMemoryCollectorStore();
    const collection = seedCollection(store);

    const blockedDetailIds = new Set<string>(["6"]); // block enrichment on the 6th listing
    const driver = new MockPageDriver({
      searchPages: twoOverlappingCells(),
      detailPages: detailPages(),
      blockedDetailIds,
    });

    // --- Pass 1: claim + run, blocked mid-enrichment ---
    const claimed = await store.claimCollection("worker-1");
    expect(claimed?.id).toBe(collection.id);

    const pass1 = await runCollection(
      { store, driver, pacing, now: clock },
      collection.id,
      "worker-1",
    );

    // Two overlapping cells discovered 12 cards, deduped to 10 unique (2 dupes).
    const m1 = store.metricsFor(collection.id);
    expect(m1.planned_cells).toBe(2);
    expect(m1.completed_cells).toBe(2);
    expect(m1.cards_discovered).toBe(12);
    expect(m1.unique_listings).toBe(10);
    expect(m1.duplicate_discoveries).toBe(2);
    expect(m1.detail_pages_completed).toBe(5);

    // Stopped for manual intervention (login on the 6th detail), with a partial snapshot.
    expect(pass1.blocked).toBe(true);
    expect(pass1.manualActionReason).toBe("login_challenge");
    expect((await store.getCollection(collection.id))?.state).toBe(
      "manual_action_required",
    );
    const afterPass1 = store.snapshotsFor(collection.id);
    expect(afterPass1).toHaveLength(1);
    expect(afterPass1[0]?.qualityStatus).toBe("partial");
    expect(afterPass1[0]?.uniqueListingCount).toBe(10);

    // The browser window must be left OPEN on a manual-action stop — the
    // operator resolves the block in that same visible window, it must not
    // vanish on them.
    expect(driver.closeCount).toBe(0);
    expect(driver.launchCount).toBe(1);

    // --- Resume: operator resolved the block; enrich the remaining 5 ---
    blockedDetailIds.clear();
    const pass2 = await runCollection(
      { store, driver, pacing, now: clock },
      collection.id,
      "worker-1",
    );

    const m2 = store.metricsFor(collection.id);
    expect(m2.detail_pages_completed).toBe(10);
    expect(pass2.blocked).toBe(false);
    expect(pass2.quality).toBe("complete");
    expect((await store.getCollection(collection.id))?.state).toBe("completed");

    // A second, complete snapshot with all 10 listings detailed.
    const snapshots = store.snapshotsFor(collection.id);
    expect(snapshots).toHaveLength(2);
    const finalSnapshot = snapshots.find((s) => s.qualityStatus === "complete");
    expect(finalSnapshot).toBeDefined();
    expect(finalSnapshot?.uniqueListingCount).toBe(10);
    expect(finalSnapshot?.listings.every((l) => l.detail != null)).toBe(true);
    expect(finalSnapshot?.checksum).toMatch(/^[0-9a-f]{16}$/);

    // The resumed pass reused the SAME still-open browser (launch() is a
    // no-op on an already-open driver) and closed it cleanly once finished.
    expect(driver.launchCount).toBe(2);
    expect(driver.closeCount).toBe(1);
  });

  it("respects maxListings and the minimum-rating filter", async () => {
    const store = new InMemoryCollectorStore();
    const collection = seedCollection(store, {
      mode: "search_results_only",
      collectDetails: false,
      maxListings: 4,
      minRating: 4.85,
    });
    const cellA = [
      card("1", { rating: 4.9 }),
      card("2", { rating: 4.7 }), // filtered out (below 4.85)
      card("3", { rating: 4.95 }),
      card("4", { rating: 4.88 }),
      card("5", { rating: 4.86 }),
      card("6", { rating: 4.99 }),
    ];
    const driver = new MockPageDriver({
      searchPages: [searchPageHtml(cellA), searchPageHtml([])],
      detailPages: {},
    });
    await store.claimCollection("w");
    const result = await runCollection(
      { store, driver, pacing, now: clock },
      collection.id,
      "w",
    );
    // 5 cards pass the rating filter, capped at 4 unique listings.
    expect(result.uniqueListings).toBe(4);
    expect(store.metricsFor(collection.id).unique_listings).toBe(4);
  });

  it("stops with manual_action_required when search hits a CAPTCHA", async () => {
    const store = new InMemoryCollectorStore();
    const collection = seedCollection(store, {
      mode: "search_results_only",
      collectDetails: false,
    });
    const captcha = `<html><head><meta name="bai-page-state" content="captcha"></head><body>unusual traffic</body></html>`;
    const driver = new MockPageDriver({
      searchPages: [captcha, captcha],
      detailPages: {},
    });
    await store.claimCollection("w");
    const result = await runCollection(
      { store, driver, pacing, now: clock },
      collection.id,
      "w",
    );
    expect(result.blocked).toBe(true);
    expect(result.manualActionReason).toBe("captcha");
    expect((await store.getCollection(collection.id))?.state).toBe(
      "manual_action_required",
    );
    // No usable coverage → no snapshot was produced.
    expect(store.snapshotsFor(collection.id)).toHaveLength(0);
    // The browser stays open here too, even on an immediate first-cell block.
    expect(driver.closeCount).toBe(0);
  });
});
