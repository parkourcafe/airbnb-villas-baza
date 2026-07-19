import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  SNAPSHOT_NORMALIZER_VERSION,
  type SnapshotObservation,
} from "./index";

const base: SnapshotObservation = {
  observedAt: "2026-07-18T00:00:00.000Z",
  observationStatus: "active",
  parserVersion: "csv:v1",
  title: "Villa   Aruna",
  description: "A calm villa",
  photos: ["p1", "p2"],
  amenities: ["Pool", "wifi"],
  propertyType: "villa",
  latitude: -8.409518,
  longitude: 115.188919,
  rating: 4.8,
  reviewCount: 120,
  price: { amount: "3500000", currency: "IDR", unit: "night" },
  bedrooms: 3,
  bathrooms: 2,
  guestCapacity: 6,
  isSuperhost: true,
  hostExternalId: "host-1",
  officialWebsite: "https://villa-aruna.example?utm_source=ig",
  businessWhatsapp: "+6281234567890",
  directBookingUrl: "https://book.example/aruna",
};

describe("buildSnapshot", () => {
  it("stamps the normalizer version and normalizes noisy fields", () => {
    const snap = buildSnapshot(base);
    expect(snap.normalizerVersion).toBe(SNAPSHOT_NORMALIZER_VERSION);
    expect(snap.title).toBe("Villa Aruna");
    expect(snap.officialWebsite).toBe("https://villa-aruna.example/");
    expect(snap.amenities).toEqual(["pool", "wifi"]);
    // coordinates rounded to display precision (3 dp).
    expect(snap.latitude).toBe(-8.41);
    expect(snap.longitude).toBe(115.189);
  });

  it("computes a content fingerprint that ignores observation time", () => {
    const a = buildSnapshot(base);
    const b = buildSnapshot({
      ...base,
      observedAt: "2026-07-25T09:30:00.000Z",
    });
    expect(a.contentFingerprint).toBe(b.contentFingerprint);
    expect(a.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the fingerprint when content changes", () => {
    const a = buildSnapshot(base);
    const b = buildSnapshot({ ...base, rating: 4.9 });
    expect(a.contentFingerprint).not.toBe(b.contentFingerprint);
  });

  it("distinguishes not-collected from collected-null in field_presence", () => {
    const snap = buildSnapshot({
      observedAt: base.observedAt,
      observationStatus: "active",
      parserVersion: "csv:v1",
      title: "Villa",
      directBookingUrl: null, // collected but absent
      // rating not provided => not collected
    });
    expect(snap.fieldPresence.title).toBe(true);
    expect(snap.fieldPresence.direct_booking_url).toBe(true);
    expect(snap.fieldPresence.rating).toBe(false);
    expect(snap.fieldPresence.price).toBe(false);
  });

  it("raises quality flags for out-of-range values", () => {
    const snap = buildSnapshot({
      ...base,
      rating: 7,
      reviewCount: -1,
      price: { amount: "1", currency: "idr", unit: "night" },
    });
    expect(snap.qualityFlags).toContain("rating_out_of_range");
    expect(snap.qualityFlags).toContain("negative_review_count");
    expect(snap.qualityFlags).toContain("unknown_currency");
  });
});
