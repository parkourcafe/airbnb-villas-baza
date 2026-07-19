import { describe, expect, it } from "vitest";
import { buildSnapshot } from "@bai/snapshot-engine";
import type { ParsedImportRow } from "@bai/import-engine";
import { observationFromImportRow } from "./snapshot-persistence";

const row: ParsedImportRow = {
  sourceKey: "demo_fixture",
  externalId: "d1",
  observedAt: "2026-07-18T00:00:00.000Z",
  observationStatus: "active",
  title: "Villa Aruna",
  rating: 4.8,
  reviewCount: 120,
  observedPriceAmount: "3500000",
  observedPriceCurrency: "IDR",
  observedPriceUnit: "night",
};

describe("observationFromImportRow", () => {
  it("maps collected fields and marks CSV-absent fields as not collected", () => {
    const obs = observationFromImportRow(row, "csv-import:v1");
    expect(obs.parserVersion).toBe("csv-import:v1");
    expect(obs.price).toEqual({
      amount: "3500000",
      currency: "IDR",
      unit: "night",
    });
    // Content fields the CSV never carries stay undefined ("not collected").
    expect(obs.description).toBeUndefined();
    expect(obs.amenities).toBeUndefined();

    const snap = buildSnapshot(obs);
    expect(snap.fieldPresence.rating).toBe(true);
    expect(snap.fieldPresence.price).toBe(true);
    expect(snap.fieldPresence.amenities).toBe(false);
    expect(snap.fieldPresence.description).toBe(false);
  });

  it("omits price when currency is missing (cannot be compared)", () => {
    const obs = observationFromImportRow(
      { ...row, observedPriceCurrency: undefined },
      "csv-import:v1",
    );
    expect(obs.price).toBeUndefined();
    expect(buildSnapshot(obs).fieldPresence.price).toBe(false);
  });

  it("coerces an unknown price unit to 'unknown'", () => {
    const obs = observationFromImportRow(
      { ...row, observedPriceUnit: "weird" },
      "csv-import:v1",
    );
    expect(obs.price?.unit).toBe("unknown");
  });
});
