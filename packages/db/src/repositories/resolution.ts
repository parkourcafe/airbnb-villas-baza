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
