import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  detailUnavailableHtml,
  listingDetailHtml,
  loginChallengeHtml,
} from "@bai/collector-core/fixtures";
import { MockPageDriver } from "../src/browser/mock-driver";
import { InMemoryCollectorStore } from "../src/store/in-memory-store";
import type { CollectionRecord } from "../src/store/store";
import { runVerification } from "../src/runner/verify";

const pacing = { actionDelayMs: 0, retryLimit: 2, sleep: async () => {} };
const clock = () => "2026-07-19T00:00:00.000Z";

function verifyCollection(
  store: InMemoryCollectorStore,
  snapshotId: string,
): CollectionRecord {
  const record: CollectionRecord = {
    id: randomUUID(),
    organizationId: randomUUID(),
    datasetId: randomUUID(),
    sourceId: randomUUID(),
    sourceKey: "airbnb",
    market: "bali",
    mode: "verify_existing_listings",
    state: "queued",
    headed: true,
    collectDetails: false,
    maxListings: null,
    minRating: null,
    minReviewCount: null,
    selectedAreas: [],
    sourceSnapshotId: snapshotId,
  };
  store.seedCollection(record);
  return record;
}

describe("verify_existing_listings", () => {
  it("records per-listing statuses and never infers removal from one failure", async () => {
    const store = new InMemoryCollectorStore();
    const snapshotId = randomUUID();
    store.seedSnapshotListings(snapshotId, [
      listing("1"),
      listing("2"),
      listing("3"),
    ]);
    const collection = verifyCollection(store, snapshotId);

    const driver = new MockPageDriver({
      searchPages: [],
      detailPages: {
        "1": listingDetailHtml({ listingId: "1", propertyType: "Villa" }),
        "2": detailUnavailableHtml("2"),
        "3": listingDetailHtml({ listingId: "3", propertyType: "Villa" }),
      },
    });

    const result = await runVerification(
      { store, driver, pacing, now: clock },
      collection.id,
      "w",
    );

    expect(result.finalState).toBe("completed");
    expect(result.verified).toBe(3);
    const byId = Object.fromEntries(
      store.verifications.map((v) => [v.sourceListingId, v.status]),
    );
    expect(byId["1"]).toBe("active");
    expect(byId["2"]).toBe("unavailable");
    expect(byId["3"]).toBe("active");
    // None of the statuses is a "removed" status — that concept does not exist.
    expect(Object.values(byId)).not.toContain("removed");
  });

  it("stops for manual intervention on a login wall and records login_required", async () => {
    const store = new InMemoryCollectorStore();
    const snapshotId = randomUUID();
    store.seedSnapshotListings(snapshotId, [listing("1"), listing("2")]);
    const collection = verifyCollection(store, snapshotId);

    const driver = new MockPageDriver({
      searchPages: [],
      detailPages: { "1": loginChallengeHtml(), "2": loginChallengeHtml() },
    });

    const result = await runVerification(
      { store, driver, pacing, now: clock },
      collection.id,
      "w",
    );
    expect(result.blocked).toBe(true);
    expect(result.manualActionReason).toBe("login_challenge");
    expect((await store.getCollection(collection.id))?.state).toBe(
      "manual_action_required",
    );
    // Stopped after the first listing recorded login_required (not a removal).
    expect(store.verifications[0]?.status).toBe("login_required");
  });
});

function listing(id: string) {
  return {
    sourceListingId: id,
    sourceUrl: `/rooms/${id}`,
    title: `Villa ${id}`,
    area: "Bingin",
    rating: 4.8,
    reviewCount: 100,
    displayedPrice: "3000000",
    currency: "IDR",
    guestCapacity: 6,
    bedrooms: 3,
    latitude: -8.8,
    longitude: 115.11,
    detail: null,
  };
}
