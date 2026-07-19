import type { Database } from "../generated/database.types";
import type { DbClient } from "./tenancy";

type LeadStage = Database["public"]["Enums"]["lead_stage"];
type ReportStatus = Database["public"]["Enums"]["report_status"];

export interface WatchlistSummary {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export interface LeadSummary {
  id: string;
  propertyId: string;
  eventId: string | null;
  stage: LeadStage;
  priority: number;
  reasonCode: string | null;
  reasonText: string | null;
  doNotContact: boolean;
  createdAt: string;
}

export interface ReportSummary {
  id: string;
  name: string;
  reportType: string;
  status: ReportStatus;
  createdAt: string;
  readyAt: string | null;
}

interface WatchlistRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  watchlist_items: { count: number }[];
}

/** Watchlists for an organization+dataset, with a de-normalized item count. */
export async function listWatchlists(
  client: DbClient,
  organizationId: string,
  datasetId: string,
): Promise<WatchlistSummary[]> {
  const { data, error } = await client
    .from("watchlists")
    .select("id, name, description, created_at, watchlist_items(count)")
    .eq("organization_id", organizationId)
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false })
    .returns<WatchlistRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.watchlist_items?.[0]?.count ?? 0,
    createdAt: row.created_at,
  }));
}

export async function createWatchlist(
  client: DbClient,
  params: {
    organizationId: string;
    datasetId: string;
    name: string;
    description?: string;
  },
): Promise<string> {
  const { data, error } = await client
    .from("watchlists")
    .insert({
      organization_id: params.organizationId,
      dataset_id: params.datasetId,
      name: params.name,
      description: params.description ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

interface LeadRow {
  id: string;
  property_id: string;
  event_id: string | null;
  stage: LeadStage;
  priority: number;
  reason_code: string | null;
  reason_text: string | null;
  do_not_contact: boolean;
  created_at: string;
}

export async function listLeads(
  client: DbClient,
  organizationId: string,
  filters: { stage?: LeadStage } = {},
): Promise<LeadSummary[]> {
  let query = client
    .from("leads")
    .select(
      "id, property_id, event_id, stage, priority, reason_code, reason_text, do_not_contact, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (filters.stage) query = query.eq("stage", filters.stage);

  const { data, error } = await query.returns<LeadRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    eventId: row.event_id,
    stage: row.stage,
    priority: row.priority,
    reasonCode: row.reason_code,
    reasonText: row.reason_text,
    doNotContact: row.do_not_contact,
    createdAt: row.created_at,
  }));
}

/**
 * Create a lead from a property or event. Idempotent per organization+property
 * (03 §13.1 unique): a duplicate insert returns the existing lead. No outreach
 * is performed — leads capture intent and evidence only (07 §7.2).
 */
export async function createLead(
  client: DbClient,
  params: {
    organizationId: string;
    datasetId: string;
    propertyId: string;
    sourceListingId?: string | null;
    eventId?: string | null;
    reasonCode: string;
    reasonText?: string;
  },
): Promise<{ id: string; created: boolean }> {
  const { data, error } = await client
    .from("leads")
    .insert({
      organization_id: params.organizationId,
      dataset_id: params.datasetId,
      property_id: params.propertyId,
      source_listing_id: params.sourceListingId ?? null,
      event_id: params.eventId ?? null,
      reason_code: params.reasonCode,
      reason_text: params.reasonText ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique violation → the property already has a lead in this org.
    if (error.code === "23505") {
      const existing = await client
        .from("leads")
        .select("id")
        .eq("organization_id", params.organizationId)
        .eq("property_id", params.propertyId)
        .single();
      if (existing.error) throw existing.error;
      return { id: existing.data.id, created: false };
    }
    throw error;
  }
  return { id: data!.id, created: true };
}

interface ReportRow {
  id: string;
  name: string;
  report_type: string;
  status: ReportStatus;
  created_at: string;
  ready_at: string | null;
}

export async function listReports(
  client: DbClient,
  organizationId: string,
  datasetId: string,
): Promise<ReportSummary[]> {
  const { data, error } = await client
    .from("reports")
    .select("id, name, report_type, status, created_at, ready_at")
    .eq("organization_id", organizationId)
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false })
    .returns<ReportRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    reportType: row.report_type,
    status: row.status,
    createdAt: row.created_at,
    readyAt: row.ready_at,
  }));
}

/** Create a report definition with immutable parameters (07 §7.3). */
export async function createReport(
  client: DbClient,
  params: {
    organizationId: string;
    datasetId: string;
    reportType: string;
    name: string;
    parameters: Database["public"]["Tables"]["reports"]["Insert"]["parameters"];
  },
): Promise<string> {
  const { data, error } = await client
    .from("reports")
    .insert({
      organization_id: params.organizationId,
      dataset_id: params.datasetId,
      report_type: params.reportType,
      name: params.name,
      parameters: params.parameters ?? {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
