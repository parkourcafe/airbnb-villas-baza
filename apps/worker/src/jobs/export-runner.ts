import type { Sql } from "postgres";
import { toCsv } from "@bai/reporting";
import { logger } from "../observability/logger";
import type { CollectionJob } from "./queue";

export interface ExportRunnerDeps {
  sql: Sql;
  uploadCsv: (objectPath: string, content: string) => Promise<void>;
}

interface ExportRow {
  id: string;
  dataset_id: string;
  export_type: string;
  filters: Record<string, unknown>;
}

const EXPORT_TTL_DAYS = 7;

/**
 * Generate one export asynchronously (7.4). Used for selections too large for
 * the synchronous route. Rows are gathered with the worker's direct connection,
 * encoded with the injection-safe CSV encoder, uploaded, and the export marked
 * ready with its row count, recorded filters, and an expiry.
 */
export async function runExportJob(
  deps: ExportRunnerDeps,
  job: CollectionJob,
): Promise<void> {
  const exportId = String(job.payload.export_id ?? "");
  if (!exportId) throw new Error("export job payload is missing export_id");
  const { sql } = deps;

  const [exportRow] = await sql<ExportRow[]>`
    select id, dataset_id, export_type, filters
    from public.exports where id = ${exportId}
  `;
  if (!exportRow) throw new Error(`export ${exportId} not found`);

  await sql`update public.exports set status = 'running' where id = ${exportId}`;

  try {
    const { header, rows } = await buildRows(sql, exportRow);
    const csv = toCsv(rows, header);
    const objectPath = `${exportRow.dataset_id}/${exportId}.csv`;
    await deps.uploadCsv(objectPath, csv);

    await sql`
      update public.exports
      set status = 'ready', output_object_path = ${objectPath}, row_count = ${rows.length},
          ready_at = now(), expires_at = now() + make_interval(days => ${EXPORT_TTL_DAYS})
      where id = ${exportId}
    `;
    logger.info("export.completed", { exportId, rows: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      update public.exports set status = 'failed', error_summary = ${message}
      where id = ${exportId}
    `;
    throw error;
  }
}

async function buildRows(
  sql: Sql,
  exportRow: ExportRow,
): Promise<{ header: string[]; rows: (readonly unknown[])[] }> {
  // Property export (the only export_type today). Filters mirror the sync route.
  const regionId = exportRow.filters.region as string | undefined;
  const status = exportRow.filters.status as string | undefined;
  const properties = await sql<
    {
      id: string;
      canonical_name: string;
      region_id: string | null;
      current_lifecycle_status: string | null;
      property_type: string | null;
      last_observed_at: string | null;
    }[]
  >`
    select id, canonical_name, primary_region_id as region_id,
           current_lifecycle_status, property_type, last_observed_at
    from public.properties
    where dataset_id = ${exportRow.dataset_id}
      and archived_at is null
      and (${regionId ?? null}::uuid is null or primary_region_id = ${regionId ?? null}::uuid)
      and (${status ?? null}::text is null or current_lifecycle_status::text = ${status ?? null})
    order by canonical_name
  `;
  return {
    header: [
      "id",
      "canonical_name",
      "region_id",
      "lifecycle_status",
      "property_type",
      "last_observed_at",
    ],
    rows: properties.map((p) => [
      p.id,
      p.canonical_name,
      p.region_id ?? "",
      p.current_lifecycle_status ?? "",
      p.property_type ?? "",
      p.last_observed_at ?? "",
    ]),
  };
}
