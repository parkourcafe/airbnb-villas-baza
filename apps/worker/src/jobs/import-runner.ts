import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { runImport, type ImportValidationContext } from "@bai/import-engine";
import { logger } from "../observability/logger";
import type { CollectionJob } from "./queue";

export interface ImportRunnerDeps {
  sql: Sql;
  /** Download the uploaded CSV as text (from private Storage). */
  loadCsv: (objectPath: string) => Promise<string>;
}

interface ImportRow {
  id: string;
  dataset_id: string;
  source_id: string;
  input_object_path: string | null;
  collection_run_id: string | null;
}

/**
 * Process one import job: validate the uploaded CSV with the import engine, then
 * persist rejections and raw-observation metadata and update the import metrics.
 * Turning accepted rows into source listings and immutable snapshots is the
 * snapshot engine's job (Milestone 4); this runner records the raw evidence and
 * result. Everything runs in a single transaction so re-processing is idempotent.
 */
export async function runImportJob(
  deps: ImportRunnerDeps,
  job: CollectionJob,
): Promise<void> {
  const importId = String(job.payload.import_id ?? "");
  if (!importId) throw new Error("import job payload is missing import_id");
  const { sql } = deps;

  const [imp] = await sql<ImportRow[]>`
    select id, dataset_id, source_id, input_object_path, collection_run_id
    from public.imports where id = ${importId}
  `;
  if (!imp) throw new Error(`import ${importId} not found`);
  if (!imp.input_object_path) {
    throw new Error(`import ${importId} has no uploaded file`);
  }

  await sql`
    update public.imports
    set status = 'processing', started_at = coalesce(started_at, now())
    where id = ${importId}
  `;

  const sources = await sql<{ key: string }[]>`
    select key from private.data_sources where compliance_status = 'approved'
  `;
  const ctx: ImportValidationContext = {
    approvedSourceKeys: new Set(sources.map((s) => s.key)),
  };

  const content = await deps.loadCsv(imp.input_object_path);
  const outcome = runImport(content, ctx);

  await sql.begin(async (tx) => {
    for (const rejection of outcome.rejections) {
      await tx`
        insert into public.import_rejections (import_id, row_number, error_code, error_message)
        values (${importId}, ${rejection.rowNumber}, ${rejection.code}, ${rejection.message})
      `;
    }

    if (imp.collection_run_id) {
      for (const row of outcome.accepted) {
        const checksum = createHash("sha256")
          .update(JSON.stringify(row), "utf8")
          .digest("hex");
        await tx`
          insert into private.raw_observations
            (collection_run_id, source_id, external_id, observed_at, observation_status, payload_checksum, request_metadata)
          values
            (${imp.collection_run_id}, ${imp.source_id}, ${row.externalId}, ${row.observedAt},
             ${row.observationStatus}, ${checksum}, ${tx.json({ method: "manual_import" })})
          on conflict do nothing
        `;
      }
    }

    const status =
      outcome.rejections.length > 0 ? "completed_with_errors" : "completed";
    await tx`
      update public.imports
      set status = ${status}, finished_at = now(),
          total_rows = ${outcome.metrics.total},
          accepted_rows = ${outcome.metrics.accepted},
          rejected_rows = ${outcome.metrics.rejected},
          duplicate_rows = ${outcome.metrics.duplicates}
      where id = ${importId}
    `;
  });

  logger.info("import.completed", { importId, ...outcome.metrics });
}
