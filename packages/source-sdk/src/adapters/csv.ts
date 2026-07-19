import { parseCsv } from "@bai/import-engine";
import type { ObservationStatus } from "@bai/domain";
import { assertSourceExecutionAllowed } from "../compliance";
import type {
  CollectionPlan,
  HealthCheckResult,
  NormalizedListingObservation,
  RawObservation,
  SourceAdapter,
  SourceAdapterDefinition,
} from "../types";
import { validateRequiredConfig } from "../validate";

const CSV_PARSER_VERSION = "csv-adapter:v1";

/**
 * The manual CSV adapter (8.3): it wraps the import engine's parser under the
 * adapter conventions so an owner-supplied CSV can flow through the same
 * collection pipeline as any other source. Detailed validation and snapshotting
 * still happen in the import runner; this adapter surfaces the raw rows as
 * observations so the source model is uniform.
 */
export class CsvSourceAdapter implements SourceAdapter {
  readonly definition: SourceAdapterDefinition = {
    key: "manual_csv",
    displayName: "Manual CSV",
    accessMode: "manual_import",
    complianceStatus: "approved",
    // Manual CSV is a reviewed human action, not an automated collector.
    automationAllowed: false,
    capabilities: ["listing_identity", "listing_status"],
    parserVersion: CSV_PARSER_VERSION,
  };

  async validateConfiguration(config: Record<string, unknown>): Promise<void> {
    validateRequiredConfig(config, ["csv"], {
      csv: (value) => typeof value === "string" && value.length > 0,
    });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { ok: true, checkedAt: new Date().toISOString() };
  }

  async *collect(
    plan: CollectionPlan,
    signal: AbortSignal,
  ): AsyncIterable<RawObservation> {
    // Manual CSV is not automation-allowed; a manual run passes automated:false.
    assertSourceExecutionAllowed(this.definition, {
      automated: false,
      requestedCapabilities: plan.requestedCapabilities,
    });

    const csv = String(plan.configuration.csv ?? "");
    const rows = parseCsv(csv);
    for (const row of rows) {
      if (signal.aborted) return;
      yield {
        sourceKey: this.definition.key,
        externalId: String(row.external_id ?? ""),
        observedAt: String(row.observed_at ?? plan.requestedAt),
        observationStatus: String(
          row.observation_status ?? "unknown",
        ) as ObservationStatus,
        sourceUrl: row.source_url ? String(row.source_url) : undefined,
        payload: row,
        evidence: { method: "manual_csv" },
      };
    }
  }

  async normalize(
    observation: RawObservation,
  ): Promise<NormalizedListingObservation> {
    // The import runner performs full normalization; the adapter contract only
    // needs identity + status + a stable fingerprint here.
    return {
      sourceKey: observation.sourceKey,
      externalId: observation.externalId,
      sourceUrl: observation.sourceUrl,
      observedAt: observation.observedAt,
      observationStatus: observation.observationStatus,
      contentFingerprint: `${observation.sourceKey}:${observation.externalId}`,
      parserVersion: CSV_PARSER_VERSION,
    };
  }
}
