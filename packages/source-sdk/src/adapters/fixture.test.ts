import { describe, expect, it } from "vitest";
import { ComplianceError } from "@bai/domain";
import {
  assertSourceExecutionAllowed,
  CsvSourceAdapter,
  FixtureSourceAdapter,
  type CollectionPlan,
} from "../index";

function plan(overrides: Partial<CollectionPlan> = {}): CollectionPlan {
  return {
    sourceKey: "demo_fixture",
    datasetId: "dataset-1",
    requestedAt: "2026-07-20T00:00:00.000Z",
    requestedBy: "system",
    configuration: {},
    ...overrides,
  };
}

async function collectAll(
  adapter: FixtureSourceAdapter,
  p: CollectionPlan,
): Promise<Awaited<ReturnType<typeof adapter.normalize>>[]> {
  const controller = new AbortController();
  const out = [];
  for await (const obs of adapter.collect(p, controller.signal)) {
    out.push(await adapter.normalize(obs));
  }
  return out;
}

describe("FixtureSourceAdapter contract", () => {
  it("emits active/not_found/error observations with stable fingerprints", async () => {
    const adapter = new FixtureSourceAdapter();
    const results = await collectAll(adapter, plan());
    expect(results.map((r) => r.observationStatus)).toEqual([
      "active",
      "not_found",
      "source_error",
    ]);
    for (const r of results) {
      expect(r.contentFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(r.parserVersion).toBe("fixture-adapter:v1");
    }
  });

  it("does not collect fields for a not_found observation (04 §12)", async () => {
    const adapter = new FixtureSourceAdapter();
    const [, missing] = await collectAll(adapter, plan());
    expect(missing?.rating).toBeUndefined();
    expect(missing?.title).toBeUndefined();
  });

  it("filters by requested external ids", async () => {
    const adapter = new FixtureSourceAdapter();
    const results = await collectAll(
      adapter,
      plan({ externalIds: ["fixture-active-1"] }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.externalId).toBe("fixture-active-1");
  });

  it("reports a healthy check", async () => {
    const health = await new FixtureSourceAdapter().healthCheck();
    expect(health.ok).toBe(true);
  });

  it("refuses to collect when the source is not approved", async () => {
    const adapter = new FixtureSourceAdapter();
    // Simulate a disabled source by swapping the compliance status.
    const disabled = {
      ...adapter.definition,
      complianceStatus: "disabled" as const,
    };
    expect(() => assertSourceExecutionAllowed(disabled)).toThrow(
      ComplianceError,
    );
  });
});

describe("CsvSourceAdapter contract", () => {
  it("is not automation-allowed and blocks automated execution", async () => {
    const adapter = new CsvSourceAdapter();
    expect(adapter.definition.automationAllowed).toBe(false);
    expect(() =>
      assertSourceExecutionAllowed(adapter.definition, { automated: true }),
    ).toThrow(ComplianceError);
  });

  it("yields observations from a manual CSV run", async () => {
    const adapter = new CsvSourceAdapter();
    const csv =
      "source_key,external_id,observed_at,observation_status\n" +
      "manual_csv,c1,2026-07-20T00:00:00Z,active";
    const controller = new AbortController();
    const out = [];
    for await (const obs of adapter.collect(
      plan({ sourceKey: "manual_csv", configuration: { csv } }),
      controller.signal,
    )) {
      out.push(obs);
    }
    expect(out).toHaveLength(1);
    expect(out[0]?.externalId).toBe("c1");
    expect(out[0]?.observationStatus).toBe("active");
  });
});
