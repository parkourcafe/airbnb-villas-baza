import { describe, expect, it } from "vitest";
import { runImport } from "./process";
import type { ImportValidationContext } from "./validate";

/**
 * Launch follow-up (B10 / IMP-05, engine portion): the import engine must handle
 * a 25k-row file without pathological slowdown. This exercises parse → validate
 * → dedup on the full volume in-process (no DB). The live async timing against
 * Postgres is a separate integration test that runs where a database exists.
 */
const ctx: ImportValidationContext = {
  approvedSourceKeys: new Set(["demo_fixture"]),
};

function buildCsv(rows: number): string {
  const header =
    "source_key,external_id,observed_at,observation_status,rating,review_count,latitude,longitude";
  const lines = [header];
  for (let i = 0; i < rows; i += 1) {
    // Vary values deterministically; keep coordinates inside Bali coverage.
    const rating = (3 + (i % 20) / 10).toFixed(2);
    const lat = (-8.4 - (i % 100) / 1000).toFixed(4);
    const lng = (115.1 + (i % 100) / 1000).toFixed(4);
    lines.push(
      `demo_fixture,ext-${i},2026-07-18T00:00:00Z,active,${rating},${i % 500},${lat},${lng}`,
    );
  }
  return lines.join("\n");
}

describe("import engine at scale", () => {
  it("accepts a 25k-row file within a generous time budget", () => {
    const csv = buildCsv(25_000);
    const started = performance.now();
    const outcome = runImport(csv, ctx);
    const elapsedMs = performance.now() - started;

    expect(outcome.metrics.total).toBe(25_000);
    expect(outcome.metrics.accepted).toBe(25_000);
    expect(outcome.rejections).toHaveLength(0);
    // Generous ceiling to catch accidental O(n^2) regressions, not to benchmark.
    expect(elapsedMs).toBeLessThan(10_000);
  });

  it("still detects duplicates at volume", () => {
    const base = buildCsv(1_000);
    // Append an exact duplicate of the first data row.
    const firstRow = base.split("\n")[1]!;
    const outcome = runImport(`${base}\n${firstRow}`, ctx);
    expect(outcome.metrics.accepted).toBe(1_000);
    expect(outcome.duplicateCount).toBe(1);
  });
});
