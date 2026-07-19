import type { DbClient } from "./tenancy";

export interface SourceCatalogEntry {
  id: string;
  key: string;
  displayName: string;
  accessMode: string;
  complianceStatus: string;
  automationAllowed: boolean;
  capabilities: string[];
  termsReviewedAt: string | null;
  reviewExpiresAt: string | null;
  restrictionReason: string | null;
}

interface SourceCatalogRow {
  id: string;
  key: string;
  display_name: string;
  access_mode: string;
  compliance_status: string;
  automation_allowed: boolean;
  capabilities: string[];
  terms_reviewed_at: string | null;
  review_expires_at: string | null;
  restriction_reason: string | null;
}

/** The safe, credential-free source catalogue for the admin screen (8.6). */
export async function listSourceCatalog(
  client: DbClient,
): Promise<SourceCatalogEntry[]> {
  const { data, error } = await client
    .from("source_catalog")
    .select(
      "id, key, display_name, access_mode, compliance_status, automation_allowed, capabilities, terms_reviewed_at, review_expires_at, restriction_reason",
    )
    .order("key", { ascending: true })
    .returns<SourceCatalogRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    accessMode: row.access_mode,
    complianceStatus: row.compliance_status,
    automationAllowed: row.automation_allowed,
    capabilities: row.capabilities ?? [],
    termsReviewedAt: row.terms_reviewed_at,
    reviewExpiresAt: row.review_expires_at,
    restrictionReason: row.restriction_reason,
  }));
}

export interface CollectionScheduleEntry {
  id: string;
  sourceId: string;
  cadenceMinutes: number;
  enabled: boolean;
  lastEnqueuedAt: string | null;
}

interface ScheduleRow {
  id: string;
  source_id: string;
  cadence_minutes: number;
  enabled: boolean;
  last_enqueued_at: string | null;
}

export async function listCollectionSchedules(
  client: DbClient,
  datasetId: string,
): Promise<CollectionScheduleEntry[]> {
  const { data, error } = await client
    .from("collection_schedules")
    .select("id, source_id, cadence_minutes, enabled, last_enqueued_at")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false })
    .returns<ScheduleRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    cadenceMinutes: row.cadence_minutes,
    enabled: row.enabled,
    lastEnqueuedAt: row.last_enqueued_at,
  }));
}

/** Create a collection schedule (admin only, enforced by RLS). */
export async function createCollectionSchedule(
  client: DbClient,
  params: { datasetId: string; sourceId: string; cadenceMinutes: number },
): Promise<void> {
  const { error } = await client.from("collection_schedules").insert({
    dataset_id: params.datasetId,
    source_id: params.sourceId,
    cadence_minutes: params.cadenceMinutes,
  });
  if (error) throw error;
}
