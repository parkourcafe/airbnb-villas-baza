"use server";

import { redirect } from "next/navigation";
import { createBrowserCollection, listBrowserCollectionSources } from "@bai/db";
import {
  canMutateData,
  COLLECTION_MODE,
  type CollectionMode,
} from "@bai/domain";
import { BALI_MARKET } from "@bai/collector-core";
import { loadTenancyContext } from "@/lib/tenancy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "../_components/action-form";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Create a browser collection for the selected dataset. The collection is
 * queued for the operator's LOCAL collector to claim; the web app never runs a
 * browser itself. Non-viewers only (RLS enforces this again at the database).
 */
export async function createCollectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await loadTenancyContext();
  const org = ctx?.selectedOrganization ?? null;
  const dataset = ctx?.selectedDataset ?? null;
  if (!ctx || !org || !dataset) {
    return { error: "Select an organization and dataset first." };
  }
  if (!canMutateData(org.role)) {
    return { error: "Your role cannot start a collection." };
  }

  const sourceId = String(formData.get("sourceId") ?? "");
  const mode = String(formData.get("mode") ?? "") as CollectionMode;
  if (!sourceId) return { error: "Choose a source." };
  if (!COLLECTION_MODE.includes(mode))
    return { error: "Choose a collection mode." };

  const selectedAreas = formData
    .getAll("areas")
    .map((a) => String(a))
    .filter((a) => BALI_MARKET.areas.some((area) => area.key === a));
  if (mode !== "verify_existing_listings" && selectedAreas.length === 0) {
    return { error: "Select at least one area to search." };
  }

  const supabase = await createSupabaseServerClient();
  const sources = await listBrowserCollectionSources(supabase);
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return { error: "That source is not available." };

  const requestedStartRaw = String(formData.get("requestedStartAt") ?? "");
  const requestedStartAt = requestedStartRaw
    ? new Date(requestedStartRaw).toISOString()
    : null;

  let collectionId: string;
  try {
    collectionId = await createBrowserCollection(supabase, {
      organizationId: org.id,
      datasetId: dataset.id,
      sourceId: source.id,
      sourceKey: source.key,
      market: "bali",
      mode,
      selectedAreas,
      headed: formData.get("headed") != null,
      collectDetails:
        mode === "search_and_details" && formData.get("collectDetails") != null,
      maxListings: parseOptionalNumber(formData.get("maxListings")),
      minRating: parseOptionalNumber(formData.get("minRating")),
      minReviewCount: parseOptionalNumber(formData.get("minReviewCount")),
      requestedStartAt,
      state: "queued",
    });
  } catch {
    return { error: "Could not create the collection. Please try again." };
  }

  redirect(`/app/collections/${collectionId}`);
}
