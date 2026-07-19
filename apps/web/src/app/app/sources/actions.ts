"use server";

import { revalidatePath } from "next/cache";
import { createCollectionSchedule } from "@bai/db";
import { canManageOrganization } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "../_components/action-form";

/** Create a collection schedule for the selected dataset (admin only). */
export async function createScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sourceId = String(formData.get("sourceId") ?? "");
  const cadenceMinutes = Number(formData.get("cadenceMinutes") ?? 0);
  if (!sourceId || !Number.isFinite(cadenceMinutes) || cadenceMinutes <= 0) {
    return { error: "Pick a source and a positive cadence." };
  }

  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !org || !dataset) {
    return { error: "Select an organization and dataset first." };
  }
  if (!canManageOrganization(org.role)) {
    return { error: "Only an administrator can schedule collection." };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await createCollectionSchedule(supabase, {
      datasetId: dataset.id,
      sourceId,
      cadenceMinutes: Math.trunc(cadenceMinutes),
    });
  } catch {
    return { error: "Could not create the schedule (one may already exist)." };
  }
  revalidatePath("/app/sources");
  return { ok: true };
}
