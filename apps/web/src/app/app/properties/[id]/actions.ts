"use server";

import { revalidatePath } from "next/cache";
import {
  getProperty,
  mergeProperties,
  rollbackMerge,
  splitListing,
} from "@bai/db";
import { canManageOrganization } from "@bai/domain";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "../../_components/action-form";

async function requireAdmin(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    }
  | { ok: false; error: string }
> {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  if (!ctx || !org) return { ok: false, error: "No organization selected." };
  if (!canManageOrganization(org.role)) {
    return { ok: false, error: "Only an administrator can do that." };
  }
  return { ok: true, supabase: await createSupabaseServerClient() };
}

/**
 * Merge a duplicate property into a canonical one. Merge is an administrator
 * action; the check here mirrors the RPC's own admin gate. The RPC preserves
 * snapshots and source listings and records a redirect + audit entry.
 */
export async function mergePropertyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fromPropertyId = String(formData.get("fromPropertyId") ?? "");
  const toPropertyId = String(formData.get("toPropertyId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!fromPropertyId || !toPropertyId) {
    return { error: "Select a property to merge into." };
  }
  if (fromPropertyId === toPropertyId) {
    return { error: "A property cannot be merged into itself." };
  }

  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  if (!ctx || !org) return { error: "No organization selected." };
  if (!canManageOrganization(org.role)) {
    return { error: "Only an administrator can merge properties." };
  }

  const supabase = await createSupabaseServerClient();
  // Defence in depth: both properties must be readable in the same dataset.
  const [from, to] = await Promise.all([
    getProperty(supabase, fromPropertyId),
    getProperty(supabase, toPropertyId),
  ]);
  if (!from || !to || from.datasetId !== to.datasetId) {
    return { error: "Both properties must be in the same dataset." };
  }

  try {
    await mergeProperties(supabase, {
      fromPropertyId,
      toPropertyId,
      reason: reason || undefined,
    });
  } catch {
    return { error: "Could not merge the properties." };
  }
  revalidatePath(`/app/properties/${toPropertyId}`);
  return { ok: true };
}

/** Split a source listing into its own new property (admin only). */
export async function splitListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sourceListingId = String(formData.get("sourceListingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!sourceListingId) return { error: "Missing source listing." };

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  try {
    await splitListing(auth.supabase, {
      sourceListingId,
      reason: reason || undefined,
    });
  } catch {
    return { error: "Could not split the listing." };
  }
  revalidatePath("/app/properties");
  return { ok: true };
}

/** Roll back a prior merge using its redirect record (admin only). */
export async function rollbackMergeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const redirectId = String(formData.get("redirectId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!redirectId) return { error: "Missing redirect." };

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  try {
    await rollbackMerge(auth.supabase, {
      redirectId,
      reason: reason || undefined,
    });
  } catch {
    return { error: "Could not roll back the merge." };
  }
  revalidatePath("/app/properties");
  return { ok: true };
}
