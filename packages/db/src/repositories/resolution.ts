import type { DbClient } from "./tenancy";

/**
 * Merge a duplicate property into a canonical one via the hardened
 * `public.merge_properties` RPC. Authorization (dataset admin) is enforced
 * inside the function, so this can run with the RLS-scoped caller client. The
 * RPC never deletes snapshots or source listings — it reassigns and archives.
 */
export async function mergeProperties(
  client: DbClient,
  params: { fromPropertyId: string; toPropertyId: string; reason?: string },
): Promise<void> {
  const { error } = await client.rpc("merge_properties", {
    p_from: params.fromPropertyId,
    p_to: params.toPropertyId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
}

/** Split a source listing into its own new property (admin only). */
export async function splitListing(
  client: DbClient,
  params: { sourceListingId: string; reason?: string },
): Promise<string> {
  const { data, error } = await client.rpc("split_listing", {
    p_source_listing: params.sourceListingId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Reverse a prior merge precisely using its redirect record (admin only). */
export async function rollbackMerge(
  client: DbClient,
  params: { redirectId: string; reason?: string },
): Promise<void> {
  const { error } = await client.rpc("rollback_merge", {
    p_redirect: params.redirectId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
}

export interface PropertyRedirect {
  id: string;
  fromPropertyId: string;
  toPropertyId: string;
  kind: string;
  reason: string | null;
  createdAt: string;
}

interface RedirectRow {
  id: string;
  from_property_id: string;
  to_property_id: string;
  kind: string;
  reason: string | null;
  created_at: string;
}

/** Redirects that merged another property INTO this one (candidates to roll back). */
export async function listIncomingMergeRedirects(
  client: DbClient,
  toPropertyId: string,
): Promise<PropertyRedirect[]> {
  const { data, error } = await client
    .from("property_redirects")
    .select("id, from_property_id, to_property_id, kind, reason, created_at")
    .eq("to_property_id", toPropertyId)
    .eq("kind", "merge")
    .order("created_at", { ascending: false })
    .returns<RedirectRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    fromPropertyId: row.from_property_id,
    toPropertyId: row.to_property_id,
    kind: row.kind,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
