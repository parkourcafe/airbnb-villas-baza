import { describe, expect, it } from "vitest";
import type { FieldDiff } from "@bai/snapshot-engine";
import { assessRunHealth, fieldChangeEvents } from "./index";

const ctx = {
  sourceListingId: "listing-1",
  runId: "run-1",
  observedAt: "2026-07-10T00:00:00Z",
};

function diff(partial: Partial<FieldDiff> & { fieldName: string }): FieldDiff {
  return {
    fieldKind: "scalar_number",
    changeKind: "changed",
    previousValue: null,
    currentValue: null,
    absoluteDelta: null,
    percentDelta: null,
    isMaterial: true,
    ruleVersion: "field-diff:v1",
    ...partial,
  };
}

describe("fieldChangeEvents", () => {
  it("EVT-03: a non-material price diff produces no visible event", () => {
    expect(
      fieldChangeEvents([diff({ fieldName: "price", isMaterial: false })], ctx),
    ).toHaveLength(0);
  });

  it("EVT-04: a material rating change creates a rating_changed event", () => {
    const [e] = fieldChangeEvents(
      [diff({ fieldName: "rating", previousValue: 4.8, currentValue: 4.6 })],
      ctx,
    );
    expect(e?.eventType).toBe("rating_changed");
    expect(e?.previousValue).toBe(4.8);
    expect(e?.currentValue).toBe(4.6);
    expect(e?.ruleVersion).toBe("field-diff:v1");
  });

  it("EVT-05: a non-material review-count decrease is not a visible event", () => {
    expect(
      fieldChangeEvents(
        [diff({ fieldName: "review_count", changeKind: "decreased", isMaterial: false })],
        ctx,
      ),
    ).toHaveLength(0);
  });

  it("EVT-06: a host change is an observation event", () => {
    const [e] = fieldChangeEvents(
      [diff({ fieldName: "host_external_id", fieldKind: "scalar_text" })],
      ctx,
    );
    expect(e?.eventType).toBe("host_changed");
    expect(e?.explanation).toMatch(/does not assert a property sale/i);
  });

  it("EVT-07: adding a direct channel creates direct_channel_added", () => {
    const [e] = fieldChangeEvents(
      [
        diff({
          fieldName: "official_website",
          fieldKind: "scalar_text",
          changeKind: "added",
          currentValue: "https://villa.example/",
        }),
      ],
      ctx,
    );
    expect(e?.eventType).toBe("direct_channel_added");
  });

  it("does not raise a channel event when a channel is removed", () => {
    expect(
      fieldChangeEvents(
        [diff({ fieldName: "direct_booking_url", changeKind: "removed" })],
        ctx,
      ),
    ).toHaveLength(0);
  });

  it("produces stable dedupe keys across repeated runs (LIFE-08/EVT idempotency)", () => {
    const a = fieldChangeEvents([diff({ fieldName: "rating" })], ctx);
    const b = fieldChangeEvents([diff({ fieldName: "rating" })], ctx);
    expect(a[0]?.dedupeKey).toBe(b[0]?.dedupeKey);
  });
});

describe("assessRunHealth", () => {
  it("flags a >30% valid-observation drop as degraded", () => {
    const r = assessRunHealth({
      totalObservations: 60,
      validObservations: 50,
      errorObservations: 0,
      blockedObservations: 0,
      previousValidObservations: 100,
    });
    expect(r.degraded).toBe(true);
    expect(r.reasons).toContain("valid_observation_drop");
  });

  it("flags an error-rate spike and a blocked spike", () => {
    const err = assessRunHealth({
      totalObservations: 100,
      validObservations: 80,
      errorObservations: 20,
      blockedObservations: 0,
    });
    expect(err.reasons).toContain("source_error_spike");
    const blocked = assessRunHealth({
      totalObservations: 100,
      validObservations: 90,
      errorObservations: 0,
      blockedObservations: 10,
    });
    expect(blocked.reasons).toContain("blocked_spike");
  });

  it("treats a healthy run as not degraded", () => {
    const r = assessRunHealth({
      totalObservations: 100,
      validObservations: 98,
      errorObservations: 1,
      blockedObservations: 1,
      previousValidObservations: 100,
    });
    expect(r.degraded).toBe(false);
    expect(r.reasons).toEqual([]);
  });
});
