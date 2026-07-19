import { describe, expect, it } from "vitest";
import { readFixture } from "@bai/test-fixtures";
import { fileChecksum, runImport, processRows } from "./process";
import type { ImportValidationContext } from "./validate";

const ctx: ImportValidationContext = {
  approvedSourceKeys: new Set(["demo_fixture"]),
};

describe("import pipeline", () => {
  it("accepts the baseline fixture (IMP-01)", () => {
    const outcome = runImport(readFixture("baseline"), ctx);
    expect(outcome.metrics.accepted).toBe(6);
    expect(outcome.rejections).toHaveLength(0);
    expect(outcome.accepted[0]?.sourceKey).toBe("demo_fixture");
    expect(outcome.accepted[0]?.observationStatus).toBe("active");
  });

  it("rejects the invalid fixture with the expected reason codes (IMP-02)", () => {
    const outcome = runImport(readFixture("invalidRows"), ctx);
    expect(outcome.metrics.accepted).toBe(0);
    const codes = new Set(outcome.rejections.map((r) => r.code));
    for (const expected of [
      "missing_external_id",
      "invalid_timestamp",
      "rating_out_of_range",
      "negative_review_count",
      "invalid_status",
      "invalid_coordinates",
      "unknown_source",
    ] as const) {
      expect(codes).toContain(expected);
    }
  });

  it("counts identical duplicates and rejects conflicting ones (IMP-04)", () => {
    const rows = [
      {
        source_key: "demo_fixture",
        external_id: "d1",
        observed_at: "2026-07-18T00:00:00Z",
        observation_status: "active",
      },
      {
        source_key: "demo_fixture",
        external_id: "d1",
        observed_at: "2026-07-18T00:00:00Z",
        observation_status: "active",
      },
      {
        source_key: "demo_fixture",
        external_id: "d1",
        observed_at: "2026-07-19T00:00:00Z",
        observation_status: "active",
      },
    ];
    const outcome = processRows(rows, ctx);
    expect(outcome.metrics.accepted).toBe(1);
    expect(outcome.duplicateCount).toBe(1);
    expect(outcome.rejections.map((r) => r.code)).toContain(
      "duplicate_conflict",
    );
  });

  it("produces a stable idempotency checksum", () => {
    const content = readFixture("baseline");
    expect(fileChecksum(content)).toBe(fileChecksum(content));
    expect(fileChecksum(content)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws when a required header is missing", () => {
    expect(() =>
      runImport("source_key,external_id\ndemo_fixture,x", ctx),
    ).toThrow(/observed_at|observation_status/);
  });
});
