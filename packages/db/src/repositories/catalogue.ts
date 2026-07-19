import type {
  CatalogueEvent,
  Confidence,
  DatasetOverview,
  EventEvidenceItem,
  LifecycleStatus,
  ListingSnapshotSummary,
  ObservationStatus,
  PropertyDetail,
  PropertySummary,
  Region,
  SnapshotFieldDiff,
  SourceListingSummary,
} from "@bai/domain";
import type { Database } from "../generated/database.types";
import {
  encodeCursor,
  resolvePageRequest,
  type PageRequest,
} from "../pagination";
import type { DbClient } from "./tenancy";

type DbEventType = Database["public"]["Enums"]["event_type"];

/**
 * Read-only catalogue repositories (Milestone 2). They operate on the RLS-scoped
 * SSR client (`DbClient`), so every result is already restricted to datasets the
 * caller can access. Lists use keyset pagination (never OFFSET) and avoid N+1 by
 * embedding the region name in a single query.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PropertyFilters {
  regionId?: string;
  lifecycleStatus?: LifecycleStatus;
}

interface PropertyListRow {
  id: string;
  canonical_name: string;
  property_type: string | null;
  primary_region_id: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guest_capacity: number | null;
  current_lifecycle_status: LifecycleStatus | null;
  current_confidence: Confidence | null;
  first_observed_at: string | null;
  last_observed_at: string | null;
  regions: { name: string } | null;
}

function mapProperty(row: PropertyListRow): PropertySummary {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    propertyType: row.property_type,
    regionId: row.primary_region_id,
    regionName: row.regions?.name ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    guestCapacity: row.guest_capacity,
    currentLifecycleStatus: row.current_lifecycle_status,
    currentConfidence: row.current_confidence,
    firstObservedAt: row.first_observed_at,
    lastObservedAt: row.last_observed_at,
  };
}

const PROPERTY_COLUMNS =
  "id, canonical_name, property_type, primary_region_id, latitude, longitude, bedrooms, bathrooms, guest_capacity, current_lifecycle_status, current_confidence, first_observed_at, last_observed_at, regions(name)";

export async function listProperties(
  client: DbClient,
  datasetId: string,
  options: { filters?: PropertyFilters; page?: PageRequest } = {},
): Promise<Page<PropertySummary>> {
  const { limit, after } = resolvePageRequest(options.page ?? {});
  const filters = options.filters ?? {};

  let query = client
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("dataset_id", datasetId)
    .order("last_observed_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (filters.regionId) query = query.eq("primary_region_id", filters.regionId);
  if (filters.lifecycleStatus) {
    query = query.eq("current_lifecycle_status", filters.lifecycleStatus);
  }
  if (after) {
    query = query.or(
      `last_observed_at.lt.${after.sortValue},and(last_observed_at.eq.${after.sortValue},id.lt.${after.id})`,
    );
  }

  const { data, error } = await query.returns<PropertyListRow[]>();
  if (error) throw error;
  return buildPage(data ?? [], limit, mapProperty, (p) => p.lastObservedAt);
}

interface PropertyDetailRow extends PropertyListRow {
  dataset_id: string;
  slug: string | null;
  official_website: string | null;
  business_whatsapp: string | null;
  direct_booking_url: string | null;
  coordinate_precision_meters: number | null;
}

export async function getProperty(
  client: DbClient,
  propertyId: string,
): Promise<PropertyDetail | null> {
  const { data, error } = await client
    .from("properties")
    .select(
      `${PROPERTY_COLUMNS}, dataset_id, slug, official_website, business_whatsapp, direct_booking_url, coordinate_precision_meters`,
    )
    .eq("id", propertyId)
    .maybeSingle<PropertyDetailRow>();
  if (error) throw error;
  if (!data) return null;
  return {
    ...mapProperty(data),
    datasetId: data.dataset_id,
    slug: data.slug,
    officialWebsite: data.official_website,
    businessWhatsapp: data.business_whatsapp,
    directBookingUrl: data.direct_booking_url,
    coordinatePrecisionMeters: data.coordinate_precision_meters,
  };
}

interface SourceListingRow {
  id: string;
  property_id: string;
  source_id: string;
  external_id: string;
  source_url: string | null;
  current_title: string | null;
  current_observation_status: ObservationStatus | null;
  current_lifecycle_status: LifecycleStatus;
  first_seen_at: string;
  last_observed_at: string;
}

export async function listSourceListings(
  client: DbClient,
  propertyId: string,
): Promise<SourceListingSummary[]> {
  const { data, error } = await client
    .from("source_listings")
    .select(
      "id, property_id, source_id, external_id, source_url, current_title, current_observation_status, current_lifecycle_status, first_seen_at, last_observed_at",
    )
    .eq("property_id", propertyId)
    .order("last_observed_at", { ascending: false })
    .returns<SourceListingRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    sourceId: row.source_id,
    externalId: row.external_id,
    sourceUrl: row.source_url,
    currentTitle: row.current_title,
    currentObservationStatus: row.current_observation_status,
    currentLifecycleStatus: row.current_lifecycle_status,
    firstSeenAt: row.first_seen_at,
    lastObservedAt: row.last_observed_at,
  }));
}

interface SnapshotRow {
  id: string;
  source_listing_id: string;
  observed_at: string;
  observation_status: ObservationStatus;
  title: string | null;
  rating: number | null;
  review_count: number | null;
  observed_price_amount: string | null;
  observed_price_currency: string | null;
  observed_price_unit: string | null;
  is_superhost: boolean | null;
}

export async function listListingSnapshots(
  client: DbClient,
  sourceListingId: string,
  limit = 50,
): Promise<ListingSnapshotSummary[]> {
  const { data, error } = await client
    .from("listing_snapshots")
    .select(
      "id, source_listing_id, observed_at, observation_status, title, rating, review_count, observed_price_amount, observed_price_currency, observed_price_unit, is_superhost",
    )
    .eq("source_listing_id", sourceListingId)
    .order("observed_at", { ascending: false })
    .limit(limit)
    .returns<SnapshotRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceListingId: row.source_listing_id,
    observedAt: row.observed_at,
    observationStatus: row.observation_status,
    title: row.title,
    rating: row.rating,
    reviewCount: row.review_count,
    observedPriceAmount: row.observed_price_amount,
    observedPriceCurrency: row.observed_price_currency,
    observedPriceUnit: row.observed_price_unit,
    isSuperhost: row.is_superhost,
  }));
}

interface SnapshotDiffRow {
  field_name: string;
  change_kind: string;
  previous_value: unknown;
  current_value: unknown;
  absolute_delta: number | null;
  percent_delta: number | null;
  is_material: boolean;
  rule_version: string;
}

/**
 * The stored field diffs for a snapshot (its comparison against the previous
 * comparable snapshot). Material diffs first, then by field name for a stable
 * order.
 */
export async function listSnapshotDiffs(
  client: DbClient,
  currentSnapshotId: string,
): Promise<SnapshotFieldDiff[]> {
  const { data, error } = await client
    .from("snapshot_diffs")
    .select(
      "field_name, change_kind, previous_value, current_value, absolute_delta, percent_delta, is_material, rule_version",
    )
    .eq("current_snapshot_id", currentSnapshotId)
    .order("is_material", { ascending: false })
    .order("field_name", { ascending: true })
    .returns<SnapshotDiffRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    fieldName: row.field_name,
    changeKind: row.change_kind,
    previousValue: row.previous_value,
    currentValue: row.current_value,
    absoluteDelta: row.absolute_delta,
    percentDelta: row.percent_delta,
    isMaterial: row.is_material,
    ruleVersion: row.rule_version,
  }));
}

export interface EventFilters {
  eventType?: string;
  propertyId?: string;
  /** "pending" hides reviewed/dismissed; "dismissed" shows only dismissed. */
  review?: "pending" | "reviewed" | "dismissed";
}

interface EventRow {
  id: string;
  property_id: string;
  source_listing_id: string | null;
  event_type: string;
  event_at: string;
  confidence: Confidence | null;
  title: string;
  summary: string | null;
  is_reviewed: boolean;
  dismissed_at: string | null;
}

function mapEvent(row: EventRow): CatalogueEvent {
  return {
    id: row.id,
    propertyId: row.property_id,
    sourceListingId: row.source_listing_id,
    eventType: row.event_type,
    eventAt: row.event_at,
    confidence: row.confidence,
    title: row.title,
    summary: row.summary,
    isReviewed: row.is_reviewed,
    dismissedAt: row.dismissed_at,
  };
}

export async function listEvents(
  client: DbClient,
  datasetId: string,
  options: { filters?: EventFilters; page?: PageRequest } = {},
): Promise<Page<CatalogueEvent>> {
  const { limit, after } = resolvePageRequest(options.page ?? {});
  const filters = options.filters ?? {};

  let query = client
    .from("events")
    .select(
      "id, property_id, source_listing_id, event_type, event_at, confidence, title, summary, is_reviewed, dismissed_at",
    )
    .eq("dataset_id", datasetId)
    .order("event_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (filters.eventType) {
    query = query.eq("event_type", filters.eventType as DbEventType);
  }
  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (filters.review === "pending") {
    query = query.is("dismissed_at", null).eq("is_reviewed", false);
  } else if (filters.review === "reviewed") {
    query = query.eq("is_reviewed", true);
  } else if (filters.review === "dismissed") {
    query = query.not("dismissed_at", "is", null);
  }
  if (after) {
    query = query.or(
      `event_at.lt.${after.sortValue},and(event_at.eq.${after.sortValue},id.lt.${after.id})`,
    );
  }

  const { data, error } = await query.returns<EventRow[]>();
  if (error) throw error;
  return buildPage(data ?? [], limit, mapEvent, (e) => e.eventAt);
}

interface EvidenceRow {
  id: string;
  evidence_type: string;
  explanation: string;
  previous_snapshot_id: string | null;
  current_snapshot_id: string | null;
  collection_run_id: string | null;
}

export async function getEventEvidence(
  client: DbClient,
  eventId: string,
): Promise<EventEvidenceItem[]> {
  const { data, error } = await client
    .from("event_evidence")
    .select(
      "id, evidence_type, explanation, previous_snapshot_id, current_snapshot_id, collection_run_id",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .returns<EvidenceRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    evidenceType: row.evidence_type,
    explanation: row.explanation,
    previousSnapshotId: row.previous_snapshot_id,
    currentSnapshotId: row.current_snapshot_id,
    collectionRunId: row.collection_run_id,
  }));
}

export interface EventEvidenceForEvent extends EventEvidenceItem {
  eventId: string;
}

/** Evidence for several events in one query (avoids N+1 on detail/event pages). */
export async function listEvidenceForEvents(
  client: DbClient,
  eventIds: string[],
): Promise<EventEvidenceForEvent[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await client
    .from("event_evidence")
    .select(
      "id, event_id, evidence_type, explanation, previous_snapshot_id, current_snapshot_id, collection_run_id",
    )
    .in("event_id", eventIds)
    .order("created_at", { ascending: true })
    .returns<(EvidenceRow & { event_id: string })[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    eventId: row.event_id,
    id: row.id,
    evidenceType: row.evidence_type,
    explanation: row.explanation,
    previousSnapshotId: row.previous_snapshot_id,
    currentSnapshotId: row.current_snapshot_id,
    collectionRunId: row.collection_run_id,
  }));
}

async function countProperties(
  client: DbClient,
  datasetId: string,
  lifecycle?: LifecycleStatus,
): Promise<number> {
  let query = client
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", datasetId);
  if (lifecycle) query = query.eq("current_lifecycle_status", lifecycle);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getDatasetOverview(
  client: DbClient,
  datasetId: string,
): Promise<DatasetOverview> {
  const [properties, activeListings, suspectedInactive, confirmedInactive] =
    await Promise.all([
      countProperties(client, datasetId),
      countProperties(client, datasetId, "active"),
      countProperties(client, datasetId, "suspected_inactive"),
      countProperties(client, datasetId, "confirmed_inactive"),
    ]);

  const { count: events, error } = await client
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", datasetId);
  if (error) throw error;

  return {
    properties,
    activeListings,
    suspectedInactive,
    confirmedInactive,
    events: events ?? 0,
  };
}

export async function listRegions(client: DbClient): Promise<Region[]> {
  const { data, error } = await client
    .from("regions")
    .select("id, parent_id, name, slug, region_type, country_code, created_at")
    .order("name", { ascending: true })
    .returns<
      {
        id: string;
        parent_id: string | null;
        name: string;
        slug: string;
        region_type: string | null;
      }[]
    >();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    regionType: row.region_type,
    parentId: row.parent_id,
  }));
}

/** Slice an over-fetched page and derive the next keyset cursor. */
function buildPage<Row, Item extends { id: string }>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Item,
  sortValueOf: (item: Item) => string | null,
): Page<Item> {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(map);
  const last = items[items.length - 1];
  const sortValue = last ? sortValueOf(last) : null;
  const nextCursor =
    hasMore && last && sortValue
      ? encodeCursor({ sortValue, id: last.id })
      : null;
  return { items, nextCursor };
}
