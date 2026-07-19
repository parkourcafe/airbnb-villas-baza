import type { Sql } from "postgres";
import { toCsv } from "@bai/reporting";
import { logger } from "../observability/logger";
import type { CollectionJob } from "./queue";

export interface ReportRunnerDeps {
  sql: Sql;
  /** Upload the generated CSV to the private reports bucket. */
  uploadCsv: (objectPath: string, content: string) => Promise<void>;
}

interface ReportRow {
  id: string;
  dataset_id: string;
  report_type: string;
  parameters: Record<string, unknown>;
}

const REPORT_TTL_DAYS = 7;

/**
 * Generate one report asynchronously (7.3). The report's immutable parameters
 * make the output reproducible. Rows are gathered with the worker's direct
 * connection, encoded with the injection-safe CSV encoder, uploaded, and the
 * report is marked ready with its row count and an expiry.
 */
export async function runReportJob(
  deps: ReportRunnerDeps,
  job: CollectionJob,
): Promise<void> {
  const reportId = String(job.payload.report_id ?? "");
  if (!reportId) throw new Error("report job payload is missing report_id");
  const { sql } = deps;

  const [report] = await sql<ReportRow[]>`
    select id, dataset_id, report_type, parameters
    from public.reports where id = ${reportId}
  `;
  if (!report) throw new Error(`report ${reportId} not found`);

  await sql`update public.reports set status = 'running' where id = ${reportId}`;

  try {
    const { header, rows } = await buildRows(sql, report);
    const csv = toCsv(rows, header);
    const objectPath = `${report.dataset_id}/${reportId}.csv`;
    await deps.uploadCsv(objectPath, csv);

    await sql`
      update public.reports
      set status = 'ready', output_object_path = ${objectPath}, row_count = ${rows.length},
          ready_at = now(), expires_at = now() + make_interval(days => ${REPORT_TTL_DAYS})
      where id = ${reportId}
    `;
    logger.info("report.completed", { reportId, rows: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      update public.reports set status = 'failed', error_summary = ${message}
      where id = ${reportId}
    `;
    throw error;
  }
}

async function buildRows(
  sql: Sql,
  report: ReportRow,
): Promise<{ header: string[]; rows: (readonly unknown[])[] }> {
  if (report.report_type === "watchlist_summary") {
    const watchlistId = String(report.parameters.watchlist_id ?? "");
    const properties = await sql<
      {
        id: string;
        canonical_name: string;
        current_lifecycle_status: string | null;
        last_observed_at: string | null;
      }[]
    >`
      select p.id, p.canonical_name, p.current_lifecycle_status, p.last_observed_at
      from public.watchlist_items i
      join public.properties p on p.id = i.property_id
      where i.watchlist_id = ${watchlistId}
      order by p.canonical_name
    `;
    return {
      header: ["id", "canonical_name", "lifecycle_status", "last_observed_at"],
      rows: properties.map((p) => [
        p.id,
        p.canonical_name,
        p.current_lifecycle_status ?? "",
        p.last_observed_at ?? "",
      ]),
    };
  }

  // Default: an event digest for the dataset.
  const events = await sql<
    {
      event_type: string;
      title: string;
      event_at: string;
      confidence: string | null;
    }[]
  >`
    select event_type, title, event_at, confidence
    from public.events
    where dataset_id = ${report.dataset_id} and dismissed_at is null
    order by event_at desc
    limit 5000
  `;
  return {
    header: ["event_type", "title", "event_at", "confidence"],
    rows: events.map((e) => [
      e.event_type,
      e.title,
      e.event_at,
      e.confidence ?? "",
    ]),
  };
}
