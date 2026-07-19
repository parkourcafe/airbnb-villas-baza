import { describe, expect, it } from "vitest";
import {
  completionPercentage,
  computeSnapshotChecksum,
  deriveQualityStatus,
  searchCellCoverage,
  snapshotListingFingerprint,
} from "./snapshot";
import type { RawCard } from "./types";

function card(id: string, over: Partial<RawCard> = {}): RawCard {
  return {
    sourceListingId: id,
    canonicalUrl: null,
    title: null,
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

describe("coverage + completion", () => {
  it("computes coverage and whole-percent completion", () => {
    expect(searchCellCoverage(10, 5)).toBe(0.5);
    expect(completionPercentage(10, 5)).toBe(50);
    expect(searchCellCoverage(0, 0)).toBe(0);
  });
});

describe("deriveQualityStatus", () => {
  it("is complete when everything finished cleanly", () => {
    expect(
      deriveQualityStatus({
        plannedCells: 4,
        completedCells: 4,
        failedCells: 0,
        errors: 0,
      }),
    ).toBe("complete");
  });

  it("is partial with a small gap", () => {
    expect(
      deriveQualityStatus({
        plannedCells: 4,
        completedCells: 3,
        failedCells: 0,
        errors: 1,
      }),
    ).toBe("partial");
  });

  it("is degraded when coverage is poor", () => {
    expect(
      deriveQualityStatus({
        plannedCells: 10,
        completedCells: 3,
        failedCells: 2,
        errors: 5,
      }),
    ).toBe("degraded");
  });

  it("is failed when nothing was collected", () => {
    expect(
      deriveQualityStatus({
        plannedCells: 4,
        completedCells: 0,
        failedCells: 4,
        errors: 4,
      }),
    ).toBe("failed");
  });
});

describe("computeSnapshotChecksum", () => {
  it("is stable regardless of listing order", () => {
    const a = [card("1", { rating: 4.9 }), card("2", { rating: 4.5 })];
    const b = [card("2", { rating: 4.5 }), card("1", { rating: 4.9 })];
    const checksumA = computeSnapshotChecksum(
      a.map(snapshotListingFingerprint),
    );
    const checksumB = computeSnapshotChecksum(
      b.map(snapshotListingFingerprint),
    );
    expect(checksumA).toBe(checksumB);
    expect(checksumA).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when a material field changes", () => {
    const before = computeSnapshotChecksum([
      snapshotListingFingerprint(card("1", { rating: 4.9 })),
    ]);
    const after = computeSnapshotChecksum([
      snapshotListingFingerprint(card("1", { rating: 4.2 })),
    ]);
    expect(before).not.toBe(after);
  });
});
