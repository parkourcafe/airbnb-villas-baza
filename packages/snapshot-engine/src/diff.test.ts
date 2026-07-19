import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  diffSnapshots,
  type FieldDiff,
  type SnapshotObservation,
} from "./index";

const base: SnapshotObservation = {
  observedAt: "2026-07-18T00:00:00.000Z",
  observationStatus: "active",
  parserVersion: "csv:v1",
  title: "Villa Aruna",
  description: "A calm villa",
  photos: ["p1", "p2"],
  amenities: ["pool", "wifi"],
  propertyType: "villa",
  latitude: -8.409,
  longitude: 115.188,
  rating: 4.8,
  reviewCount: 120,
  price: { amount: "3500000", currency: "IDR", unit: "night" },
  bedrooms: 3,
  bathrooms: 2,
  guestCapacity: 6,
  isSuperhost: true,
  hostExternalId: "host-1",
  officialWebsite: null,
  businessWhatsapp: null,
  directBookingUrl: null,
};

function diff(next: Partial<SnapshotObservation>): FieldDiff[] {
  return diffSnapshots(buildSnapshot(base), buildSnapshot({ ...base, ...next }));
}

function byField(diffs: FieldDiff[], name: string): FieldDiff | undefined {
  return diffs.find((d) => d.fieldName === name);
}

describe("diffSnapshots", () => {
  it("produces no diffs for an identical follow-up (idempotency)", () => {
    expect(diff({})).toEqual([]);
    // Re-running the same comparison is deterministic.
    expect(diffSnapshots(buildSnapshot(base), buildSnapshot(base))).toEqual(
      diffSnapshots(buildSnapshot(base), buildSnapshot(base)),
    );
  });

  it("flags a >=5% price change as material with exact deltas", () => {
    const d = byField(diff({ price: { amount: "3800000", currency: "IDR", unit: "night" } }), "price");
    expect(d?.changeKind).toBe("increased");
    expect(d?.absoluteDelta).toBe(300000);
    expect(d?.percentDelta).toBeCloseTo(0.0857, 4);
    expect(d?.isMaterial).toBe(true);
  });

  it("keeps a sub-5% price change but marks it immaterial", () => {
    const d = byField(diff({ price: { amount: "3550000", currency: "IDR", unit: "night" } }), "price");
    expect(d?.isMaterial).toBe(false);
    expect(d?.absoluteDelta).toBe(50000);
  });

  it("does not compare prices in different currencies (scenario 13)", () => {
    expect(diff({ price: { amount: "250", currency: "USD", unit: "night" } })).toEqual([]);
  });

  it("does not compare night vs stay pricing", () => {
    expect(diff({ price: { amount: "3500000", currency: "IDR", unit: "stay" } })).toEqual([]);
  });

  it("flags a rating change of at least 0.05 as material", () => {
    expect(byField(diff({ rating: 4.85 }), "rating")?.isMaterial).toBe(true);
    expect(byField(diff({ rating: 4.83 }), "rating")?.isMaterial).toBe(false);
  });

  it("treats a review-count increase as material but a decrease as not", () => {
    const up = byField(diff({ reviewCount: 130 }), "review_count");
    expect(up?.changeKind).toBe("increased");
    expect(up?.isMaterial).toBe(true);
    const down = byField(diff({ reviewCount: 110 }), "review_count");
    expect(down?.changeKind).toBe("decreased");
    expect(down?.isMaterial).toBe(false);
  });

  it("ignores whitespace-only title changes but detects real ones", () => {
    expect(byField(diff({ title: "Villa   Aruna" }), "title")).toBeUndefined();
    const real = byField(diff({ title: "Villa Aruna Deluxe" }), "title");
    expect(real?.fieldKind).toBe("hash");
    expect(real?.isMaterial).toBe(true);
  });

  it("diffs amenities as a set with normalized values", () => {
    const d = byField(diff({ amenities: ["pool", "kitchen"] }), "amenities");
    expect(d?.fieldKind).toBe("set");
    expect(d?.previousValue).toEqual(["pool", "wifi"]);
    expect(d?.currentValue).toEqual(["kitchen", "pool"]);
  });

  it("detects boolean, host and location changes", () => {
    expect(byField(diff({ isSuperhost: false }), "is_superhost")?.changeKind).toBe("changed");
    expect(byField(diff({ hostExternalId: "host-2" }), "host_external_id")?.isMaterial).toBe(true);
    const loc = byField(diff({ latitude: -8.5 }), "location");
    expect(loc?.fieldKind).toBe("location");
  });

  it("records added/removed direct channels", () => {
    const added = byField(diff({ directBookingUrl: "https://book.example/x" }), "direct_booking_url");
    expect(added?.changeKind).toBe("added");
    expect(added?.previousValue).toBeNull();
  });

  it("never diffs a field that was not collected in the follow-up (scenario 12)", () => {
    // rating omitted entirely in the follow-up => not collected => no diff.
    const next = buildSnapshot({ ...base, rating: undefined });
    const diffs = diffSnapshots(buildSnapshot(base), next);
    expect(byField(diffs, "rating")).toBeUndefined();
  });

  it("suppresses all diffs when parsers are incompatible (scenario 11)", () => {
    const prev = buildSnapshot(base);
    const curr = buildSnapshot({ ...base, parserVersion: "csv:v2", rating: 4.0 });
    expect(diffSnapshots(prev, curr)).toEqual([]);
    // Explicitly asserting compatibility re-enables the diff.
    expect(
      diffSnapshots(prev, curr, { parserCompatible: true }).length,
    ).toBeGreaterThan(0);
  });

  it("stamps the materiality rule version on every diff", () => {
    for (const d of diff({ rating: 4.6, reviewCount: 200 })) {
      expect(d.ruleVersion).toBe("field-diff:v1");
    }
  });
});
