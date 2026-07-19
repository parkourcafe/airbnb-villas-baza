import type { Sql } from "postgres";
import { assertSourceExecutionAllowed } from "@bai/source-sdk";
import type {
  NormalizedListingObservation,
  SourceAdapter,
  SourceRegistry,
} from "@bai/source-sdk";
import type { ParsedImportRow } from "@bai/import-engine";
import { logger } from "../observability/logger";
import type { CollectionJob } from "./queue";
import { persistAcceptedRow, type SnapshotPersistCtx } from "./snapshot-persistence";

export interface CollectRunnerDeps {
  sql: Sql;
  registry: SourceRegistry;
}

interface RunRow {
  id: string;
  dataset_id: string;
  source_id: string;
  is_degraded: boolean;
  source_key: string;
  compliance_status: string;
  automation_allowed: boolean;
  capabilities: string[];
  review_expires_at: string | null;
}

/** Map an adapter's normalized observation onto the import-row shape the M4/M5 persistence consumes. */
function importRowFromNormalized(
  obs: NormalizedListingObservation,
): ParsedImportRow {
  return {
    sourceKey: obs.sourceKey,
    externalId: obs.externalId,
    sourceUrl: obs.sourceUrl,
    title: obs.title,
    observedAt: obs.observedAt,
    observationStatus: obs.observationStatus,
    region: obs.regionName,
    latitude: obs.latitude,
    longitude: obs.longitude,
    rating: obs.rating,
    reviewCount: obs.reviewCount,
    observedPriceAmount: obs.observedPrice?.amount,
    observedPriceCurrency: obs.observedPrice?.currency,
    observedPriceUnit: obs.observedPrice?.unit,
    bedrooms: obs.bedrooms,
    bathrooms: obs.bathrooms,
    guestCapacity: obs.guestCapacity,
    isSuperhost: obs.isSuperhost,
    hostExternalId: obs.hostExternalId,
    officialWebsite: obs.officialWebsite,
    businessWhatsapp: obs.businessWhatsapp,
    directBookingUrl: obs.directBookingUrl,
  };
}

/**
 * Run one collection job through an approved source adapter. The compliance gate
 * is enforced BEFORE any adapter work — a disabled/pending source (or an
 * automated run of a source that forbids automation) throws and the job fails
 * without collecting anything (08 acceptance). Collected observations flow
 * through the same snapshot/diff/lifecycle persistence as CSV imports.
 */
export async function runCollectJob(
  deps: CollectRunnerDeps,
  job: CollectionJob,
): Promise<void> {
  const runId = job.collection_run_id;
  if (!runId) throw new Error("collect job is missing a collection run");
  const { sql } = deps;

  const [run] = await sql<RunRow[]>`
    select r.id, r.dataset_id, r.source_id, r.is_degraded,
           s.key as source_key, s.compliance_status, s.automation_allowed,
           s.capabilities, s.review_expires_at
    from private.collection_runs r
    join private.data_sources s on s.id = r.source_id
    where r.id = ${runId}
  `;
  if (!run) throw new Error(`collection run ${runId} not found`);

  const adapter: SourceAdapter | undefined = deps.registry.get(run.source_key);
  if (!adapter) {
    throw new Error(`no registered adapter for source "${run.source_key}"`);
  }

  // The gate uses the adapter's declared definition; the DB status is the
  // authoritative record and must also be approved.
  assertSourceExecutionAllowed(adapter.definition, { automated: true });
  if (run.compliance_status !== "approved") {
    throw new Error(`source "${run.source_key}" is not approved`);
  }

  await sql`update private.collection_runs set status = 'running', started_at = coalesce(started_at, now()) where id = ${runId}`;

  const ctx: SnapshotPersistCtx = {
    datasetId: run.dataset_id,
    sourceId: run.source_id,
    runId,
    parserVersion: adapter.definition.parserVersion,
    runDegraded: run.is_degraded,
  };

  let total = 0;
  const controller = new AbortController();
  const plan = {
    sourceKey: run.source_key,
    datasetId: run.dataset_id,
    requestedAt: new Date().toISOString(),
    requestedBy: "worker",
    configuration: (job.payload.configuration as Record<string, unknown>) ?? {},
  };

  for await (const observation of adapter.collect(plan, controller.signal)) {
    const normalized = await adapter.normalize(observation);
    total += 1;
    await sql.begin(async (tx) => {
      await persistAcceptedRow(tx, ctx, importRowFromNormalized(normalized));
    });
  }

  await sql`
    update private.collection_runs
    set status = 'completed', finished_at = now(), total_observations = ${total}
    where id = ${runId}
  `;
  logger.info("collect.completed", { runId, source: run.source_key, total });
}
