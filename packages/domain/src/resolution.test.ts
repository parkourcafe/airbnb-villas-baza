import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  nameSimilarity,
  rankMergeCandidates,
} from "./resolution";

describe("nameSimilarity", () => {
  it("is 1 for identical names ignoring case/punctuation", () => {
    expect(nameSimilarity("Villa Aruna", "villa  aruna!")).toBe(1);
  });
  it("is high for near-duplicates and low for unrelated names", () => {
    expect(nameSimilarity("Villa Aruna", "Villa Aruna Deluxe")).toBeGreaterThan(
      0.5,
    );
    expect(nameSimilarity("Villa Aruna", "Ocean Breeze")).toBeLessThan(0.4);
  });
});

describe("haversineMeters", () => {
  it("is ~0 for the same point and grows with distance", () => {
    const a = { latitude: -8.409, longitude: 115.188 };
    expect(haversineMeters(a, a)).toBeCloseTo(0, 5);
    const b = { latitude: -8.5, longitude: 115.2 };
    expect(haversineMeters(a, b)).toBeGreaterThan(5_000);
  });
});

describe("rankMergeCandidates", () => {
  const target = {
    id: "t",
    name: "Villa Aruna",
    latitude: -8.409,
    longitude: 115.188,
  };

  it("ranks a near-name, near-location candidate first", () => {
    const ranked = rankMergeCandidates(target, [
      { id: "far", name: "Ocean Breeze", latitude: -8.9, longitude: 115.5 },
      { id: "dup", name: "Villa Aruna", latitude: -8.41, longitude: 115.189 },
      {
        id: "mid",
        name: "Villa Aruna Deluxe",
        latitude: -8.6,
        longitude: 115.3,
      },
    ]);
    expect(ranked[0]?.id).toBe("dup");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("falls back to name-only when coordinates are missing", () => {
    const ranked = rankMergeCandidates(
      { ...target, latitude: null, longitude: null },
      [
        { id: "a", name: "Ocean Breeze", latitude: null, longitude: null },
        { id: "b", name: "Villa Aruna", latitude: null, longitude: null },
      ],
    );
    expect(ranked[0]?.id).toBe("b");
    expect(ranked[0]!.distanceMeters).toBeNull();
  });
});
