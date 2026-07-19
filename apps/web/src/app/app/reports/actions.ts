"use server";

import { revalidatePath } from "next/cache";
import { createReport, listWatchlists } from "@bai/db";
import { canMutateData } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "../_components/action-form";

/**
 * Create a report definition with immutable parameters (a DB trigger freezes the
 * parameters column). Async generation + signed download are a worker job; this
 * records the reproducible request.
 */
export async function createReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const reportType = String(formData.get("reportType") ?? "").trim();
  const watchlistId = String(formData.get("watchlistId") ?? "").trim();
  if (!name || !reportType) {
    return { error: "A report name and type are required." };
  }

  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !org || !dataset) {
    return { error: "Select an organization and dataset first." };
  }
  if (!canMutateData(org.role)) {
    return { error: "Your role cannot create reports." };
  }

  const supabase = await createSupabaseServerClient();
  // Defence in depth: a watchlist parameter must belong to this org/dataset.
  if (watchlistId) {
    const watchlists = await listWatchlists(supabase, org.id, dataset.id);
    if (!watchlists.some((w) => w.id === watchlistId)) {
      return { error: "That watchlist is not in the selected dataset." };
    }
  }

  try {
    await createReport(supabase, {
      organizationId: org.id,
      datasetId: dataset.id,
      reportType,
      name,
      parameters: watchlistId ? { watchlist_id: watchlistId } : {},
    });
  } catch {
    return { error: "Could not create the report." };
  }
  revalidatePath("/app/reports");
  return { ok: true };
}
