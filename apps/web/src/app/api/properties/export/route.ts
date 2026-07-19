import { listProperties } from "@bai/db";
import type { LifecycleStatus } from "@bai/domain";
import { toCsv } from "@bai/reporting";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Synchronous CSV export of the current property selection (6.2). Filters are
 * read from the query string and recorded in the response headers. Exports up to
 * SYNC_LIMIT rows inline; a larger selection must go through an async export job
 * (7.4). All reads are RLS-scoped, and cells are formula-injection-safe.
 */
export const dynamic = "force-dynamic";

const SYNC_LIMIT = 10_000;
const PAGE = 200;

export async function GET(request: Request): Promise<Response> {
  const ctx = await loadTenancyContext();
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !dataset) {
    return new Response("no dataset selected", { status: 400 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const filters = {
    regionId: url.searchParams.get("region") || undefined,
    lifecycleStatus: (statusParam as LifecycleStatus | null) || undefined,
  };

  const supabase = await createSupabaseServerClient();
  const rows: (readonly unknown[])[] = [];
  let cursor: string | undefined;
  let truncated = false;

  // Keyset-paginate up to the synchronous cap.
  for (;;) {
    const page = await listProperties(supabase, dataset.id, {
      filters,
      page: { cursor, limit: PAGE },
    });
    for (const p of page.items) {
      rows.push([
        p.id,
        p.canonicalName,
        p.regionName ?? "",
        p.currentLifecycleStatus ?? "",
        p.propertyType ?? "",
        p.guestCapacity ?? "",
        p.lastObservedAt ?? "",
      ]);
      if (rows.length >= SYNC_LIMIT) {
        truncated = true;
        break;
      }
    }
    if (truncated || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  if (truncated) {
    return new Response(
      JSON.stringify({
        error: "selection_too_large",
        message: `More than ${SYNC_LIMIT} rows — use an async export.`,
      }),
      { status: 413, headers: { "content-type": "application/json" } },
    );
  }

  const csv = toCsv(rows, [
    "id",
    "canonical_name",
    "region",
    "lifecycle_status",
    "property_type",
    "guest_capacity",
    "last_observed_at",
  ]);

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="properties-${dataset.id}.csv"`,
      "x-bai-filters": JSON.stringify(filters),
      "x-bai-row-count": String(rows.length),
    },
  });
}
