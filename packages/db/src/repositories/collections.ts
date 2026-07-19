import type {
  CollectionJobDetail,
  CollectionJobSummary,
  CollectionMode,
  CollectionObservationSummary,
  ListingVerificationSummary,
  MarketSnapshotSummary,
  SearchCellSummary,
} from "@bai/domain";
import type { Database } from "../generated/database.types";
import type { DbClient } from "./tenancy";

type CollectionRow = Database["public"]["Tables"]["browser_collections"]["Row"];
type SearchCellRow =
  Database["public"]["Tables"]["collection_search_cells"]["Row"];
type ObservationRow =
  Database["public"]["Tables"]["collection_observations"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["market_snapshots"]["Row"];
type SnapshotListingRow =
  Database["public"]["Tables"]["market_snapshot_listings"]["Row"];
type VerificationRow =
  Database["public"]["Tables"]["listing_verifications"]["Row"];

export interface BrowserCollectionSource {
  id: string;
  key: string;
  displayName: string;
  accessMode: string;
  complianceStatus: string;
}

const COLLECTION_COLUMNS =
  "id, dataset_id, source_key, market, mode, state, headed, collect_details, max_listings, min_rating, min_review_count, selected_areas, requested_start_at, manual_action_reason, manual_action_detail, planned_cells, completed_cells, cards_discovered, unique_listings, duplicate_discoveries, detail_pages_completed, warning_count, error_count, current_area, current_cell, created_at, started_at, finished_at, heartbeat_at";

function mapSummary(row: CollectionRow): CollectionJobSummary {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    source: row.source_key,
    market: row.market,
    mode: row.mode as CollectionMode,
    state: row.state,
    headed: row.headed,
    collectDetails: row.collect_details,
    maxListings: row.max_listings,
    minRating: row.min_rating,
    minReviewCount: row.min_review_count,
    requestedStartAt: row.requested_start_at,
    manualActionReason: row.manual_action_reason,
    manualActionDetail: row.manual_action_detail,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    lastHeartbeatAt: row.heartbeat_at,
  };
}

function mapDetail(row: CollectionRow): CollectionJobDetail {
  return {
    ...mapSummary(row),
    selectedAreas: row.selected_areas ?? [],
    plannedCells: row.planned_cells,
    completedCells: row.completed_cells,
    cardsDiscovered: row.cards_discovered,
    uniqueListings: row.unique_listings,
    duplicateDiscoveries: row.duplicate_discoveries,
    detailPagesCompleted: row.detail_pages_completed,
    warnings: row.warning_count,
    errors: row.error_count,
    currentArea: row.current_area,
    currentCell: row.current_cell,
  };
}

export async function listBrowserCollections(
  client: DbClient,
  datasetId: string,
): Promise<CollectionJobSummary[]> {
  const { data, error } = await client
    .from("browser_collections")
    .select(COLLECTION_COLUMNS)
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CollectionRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapSummary);
}

export async function getBrowserCollection(
  client: DbClient,
  collectionId: string,
): Promise<CollectionJobDetail | null> {
  const { data, error } = await client
    .from("browser_collections")
    .select(COLLECTION_COLUMNS)
    .eq("id", collectionId)
    .maybeSingle<CollectionRow>();
  if (error) throw error;
  return data ? mapDetail(data) : null;
}

export async function listSearchCells(
  client: DbClient,
  collectionId: string,
): Promise<SearchCellSummary[]> {
  const { data, error } = await client
    .from("collection_search_cells")
    .select(
      "id, collection_id, parent_area, north, south, east, west, zoom, status, listings_discovered, started_at, completed_at",
    )
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: true })
    .returns<SearchCellRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    parentArea: row.parent_area,
    north: row.north,
    south: row.south,
    east: row.east,
    west: row.west,
    zoom: row.zoom,
    status: row.status,
    listingsDiscovered: row.listings_discovered,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

export async function listCollectionObservations(
  client: DbClient,
  collectionId: string,
  limit = 500,
): Promise<CollectionObservationSummary[]> {
  const { data, error } = await client
    .from("collection_observations")
    .select(
      "id, collection_id, source_listing_id, source_url, title, area, rating, review_count, displayed_price, currency, guest_capacity, bedrooms, latitude, longitude, detail_collected, observed_at",
    )
    .eq("collection_id", collectionId)
    .order("observed_at", { ascending: false })
    .limit(limit)
    .returns<ObservationRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    source: "airbnb",
    sourceListingId: row.source_listing_id,
    sourceUrl: row.source_url,
    title: row.title,
    area: row.area,
    rating: row.rating,
    reviewCount: row.review_count,
    displayedPrice: row.displayed_price,
    currency: row.currency,
    guestCapacity: row.guest_capacity,
    bedrooms: row.bedrooms,
    latitude: row.latitude,
    longitude: row.longitude,
    detailCollected: row.detail_collected,
    observedAt: row.observed_at,
  }));
}

export async function listListingVerifications(
  client: DbClient,
  collectionId: string,
): Promise<ListingVerificationSummary[]> {
  const { data, error } = await client
    .from("listing_verifications")
    .select(
      "id, collection_id, source_listing_id, source_url, status, observed_at",
    )
    .eq("collection_id", collectionId)
    .order("observed_at", { ascending: false })
    .returns<VerificationRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    sourceListingId: row.source_listing_id,
    sourceUrl: row.source_url,
    status: row.status,
    observedAt: row.observed_at,
  }));
}

export async function listBrowserCollectionSources(
  client: DbClient,
): Promise<BrowserCollectionSource[]> {
  const { data, error } = await client
    .from("browser_collection_sources")
    .select("id, key, display_name, access_mode, compliance_status")
    .order("display_name", { ascending: true })
    .returns<
      {
        id: string;
        key: string;
        display_name: string;
        access_mode: string;
        compliance_status: string;
      }[]
    >();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    accessMode: row.access_mode,
    complianceStatus: row.compliance_status,
  }));
}

export interface CreateBrowserCollectionInput {
  organizationId: string;
  datasetId: string;
  sourceId: string;
  sourceKey: string;
  market: string;
  mode: CollectionMode;
  selectedAreas: string[];
  headed: boolean;
  collectDetails: boolean;
  maxListings?: number | null;
  minRating?: number | null;
  minReviewCount?: number | null;
  requestedStartAt?: string | null;
  sourceSnapshotId?: string | null;
  state: Database["public"]["Enums"]["collection_job_state"];
  config?: Database["public"]["Tables"]["browser_collections"]["Insert"]["config"];
}

export async function createBrowserCollection(
  client: DbClient,
  input: CreateBrowserCollectionInput,
): Promise<string> {
  const { data, error } = await client
    .from("browser_collections")
    .insert({
      organization_id: input.organizationId,
      dataset_id: input.datasetId,
      source_id: input.sourceId,
      source_key: input.sourceKey,
      market: input.market,
      mode: input.mode,
      state: input.state,
      headed: input.headed,
      collect_details: input.collectDetails,
      max_listings: input.maxListings ?? null,
      min_rating: input.minRating ?? null,
      min_review_count: input.minReviewCount ?? null,
      selected_areas: input.selectedAreas,
      requested_start_at: input.requestedStartAt ?? null,
      source_snapshot_id: input.sourceSnapshotId ?? null,
      config: input.config ?? {},
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

function mapSnapshot(row: SnapshotRow): MarketSnapshotSummary {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    collectionId: row.collection_id,
    source: row.source_key,
    market: row.market,
    observationStartedAt: row.observation_started_at,
    observationCompletedAt: row.observation_completed_at,
    uniqueListingCount: row.unique_listing_count,
    searchCellCoverage: row.search_cell_coverage,
    completionPercentage: row.completion_percentage,
    qualityStatus: row.quality_status,
    warningCount: row.warning_count,
    checksum: row.checksum,
    createdAt: row.created_at,
  };
}

const SNAPSHOT_COLUMNS =
  "id, dataset_id, collection_id, source_key, market, observation_started_at, observation_completed_at, unique_listing_count, search_cell_coverage, completion_percentage, quality_status, warning_count, checksum, created_at";

export async function listMarketSnapshots(
  client: DbClient,
  datasetId: string,
): Promise<MarketSnapshotSummary[]> {
  const { data, error } = await client
    .from("market_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<SnapshotRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapSnapshot);
}

export async function getMarketSnapshot(
  client: DbClient,
  snapshotId: string,
): Promise<MarketSnapshotSummary | null> {
  const { data, error } = await client
    .from("market_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("id", snapshotId)
    .maybeSingle<SnapshotRow>();
  if (error) throw error;
  return data ? mapSnapshot(data) : null;
}

export interface SnapshotListingSummary {
  id: string;
  sourceListingId: string;
  sourceUrl: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  reviewCount: number | null;
  displayedPrice: string | null;
  currency: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function listSnapshotListings(
  client: DbClient,
  snapshotId: string,
  limit = 500,
): Promise<SnapshotListingSummary[]> {
  const { data, error } = await client
    .from("market_snapshot_listings")
    .select(
      "id, source_listing_id, source_url, title, area, rating, review_count, displayed_price, currency, latitude, longitude",
    )
    .eq("snapshot_id", snapshotId)
    .order("title", { ascending: true })
    .limit(limit)
    .returns<SnapshotListingRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceListingId: row.source_listing_id,
    sourceUrl: row.source_url,
    title: row.title,
    area: row.area,
    rating: row.rating,
    reviewCount: row.review_count,
    displayedPrice: row.displayed_price,
    currency: row.currency,
    latitude: row.latitude,
    longitude: row.longitude,
  }));
}
