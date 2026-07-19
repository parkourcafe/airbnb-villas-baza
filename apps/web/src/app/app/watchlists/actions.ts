"use server";

import { revalidatePath } from "next/cache";
import { createWatchlist } from "@bai/db";
import { canMutateData } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "../_components/action-form";

/**
 * Create an organization-private watchlist. Authorized in app code from the
 * membership/access tables; the insert runs through the RLS-scoped server
 * client, so the policy is the second line of defence.
 */
export async function createWatchlistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "A watchlist name is required." };

  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !org || !dataset) {
    return { error: "Select an organization and dataset first." };
  }
  if (!canMutateData(org.role)) {
    return { error: "Your role cannot create watchlists." };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await createWatchlist(supabase, {
      organizationId: org.id,
      datasetId: dataset.id,
      name,
      description: description || undefined,
    });
  } catch {
    return { error: "Could not create the watchlist (the name may be taken)." };
  }
  revalidatePath("/app/watchlists");
  return { ok: true };
}
