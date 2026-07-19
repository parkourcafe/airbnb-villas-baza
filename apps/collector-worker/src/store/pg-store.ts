import type { JSONValue, Sql } from "postgres";
import type { SearchCell } from "@bai/collector-core";
import type { CollectionJobState, SearchCellStatus } from "@bai/domain";
import type {
  CollectionRecord,
  CollectorStore,
  MetricsUpdate,
  ObservationInput,
  SetStateOptions,
  SnapshotInput,
  SnapshotListingInput,
  StoredCell,
  StoredObservation,
  VerificationInput,
} from "./store";

/**
 * Postgres-backed store for production. The local worker connects with a
 * server-only connection string (the `postgres` role bypasses RLS), so it reads
 * and writes the browser-collection tables directly and claims jobs through the
 * atomic `private.claim_browser_collection` function.
 */
export class PgCollectorStore implements CollectorStore {
  constructor(private readonly sql: Sql) {}

  async claimCollection(workerId: string): Promise<CollectionRecord | null> {
    const rows = await this.sql<CollectionRow[]>`
      select * from private.claim_browser_collection(${workerId})
    `;
    const row = rows[0];
    return row && row.id ? mapCollection(row) : null;
  }

  async getCollection(collectionId: string): Promise<CollectionRecord | null> {
    const rows = await this.sql<CollectionRow[]>`
      select * from public.browser_collections where id = ${collectionId}
    `;
    const row = rows[0];
    return row ? mapCollection(row) : null;
  }

  async setState(
    collectionId: string,
    state: CollectionJobState,
    options: SetStateOptions = {},
  ): Promise<void> {
    await this.sql`
      update public.browser_collections
      set state = ${state},
          manual_action_reason = ${options.manualActionReason ?? null},
          manual_action_detail = ${options.manualActionDetail ?? null},
          finished_at = ${options.finished ? this.sql`now()` : this.sql`finished_at`},
          updated_at = now()
      where id = ${collectionId}
    `;
  }

  async heartbeat(
    collectionId: string,
    workerId: string,
    metrics: MetricsUpdate,
  ): Promise<void> {
    await this.sql`
      select private.heartbeat_browser_collection(
        ${workerId}, ${collectionId},
        null::app.collection_job_state, ${this.sql.json(metrics as unknown as JSONValue)}::jsonb
      )
    `;
  }

  async insertSearchCells(
    collectionId: string,
    datasetId: string,
    cells: readonly SearchCell[],
  ): Promise<StoredCell[]> {
    const stored: StoredCell[] = [];
    for (const cell of cells) {
      const rows = await this.sql<{ id: string }[]>`
        insert into public.collection_search_cells
          (collection_id, dataset_id, parent_area, north, south, east, west, zoom)
        values (${collectionId}, ${datasetId}, ${cell.parentArea},
                ${cell.north}, ${cell.south}, ${cell.east}, ${cell.west}, ${cell.zoom})
        returning id
      `;
      stored.push({
        id: rows[0]!.id,
        collectionId,
        parentArea: cell.parentArea,
        north: cell.north,
        south: cell.south,
        east: cell.east,
        west: cell.west,
        zoom: cell.zoom,
        status: "pending",
        listingsDiscovered: 0,
      });
    }
    return stored;
  }

  async listCells(collectionId: string): Promise<StoredCell[]> {
    const rows = await this.sql<CellRow[]>`
      select id, collection_id, parent_area, north, south, east, west, zoom, status, listings_discovered
      from public.collection_search_cells
      where collection_id = ${collectionId}
      order by created_at asc
    `;
    return rows.map(mapCell);
  }

  async updateCellStatus(
    cellId: string,
    status: SearchCellStatus,
    options: {
      listingsDiscovered?: number;
      started?: boolean;
      completed?: boolean;
    } = {},
  ): Promise<void> {
    await this.sql`
      update public.collection_search_cells
      set status = ${status},
          listings_discovered = ${options.listingsDiscovered ?? this.sql`listings_discovered`},
          started_at = ${options.started ? this.sql`coalesce(started_at, now())` : this.sql`started_at`},
          completed_at = ${options.completed ? this.sql`now()` : this.sql`completed_at`}
      where id = ${cellId}
    `;
  }

  async upsertObservations(
    collectionId: string,
    datasetId: string,
    sourceId: string,
    observations: readonly ObservationInput[],
  ): Promise<void> {
    for (const obs of observations) {
      await this.sql`
        insert into public.collection_observations
          (collection_id, dataset_id, source_id, source_listing_id, source_url, title, area,
           rating, review_count, displayed_price, currency, guest_capacity, bedrooms,
           latitude, longitude, image_url, discovery_cell_ids, discovery_count, observed_at)
        values
          (${collectionId}, ${datasetId}, ${sourceId}, ${obs.sourceListingId}, ${obs.sourceUrl},
           ${obs.title}, ${obs.area}, ${obs.rating}, ${obs.reviewCount}, ${obs.displayedPrice},
           ${obs.currency}, ${obs.guestCapacity}, ${obs.bedrooms}, ${obs.latitude}, ${obs.longitude},
           ${obs.imageUrl}, ${this.sql.array(obs.discoveryCellIds)}, ${obs.discoveryCount}, ${obs.observedAt})
        on conflict (collection_id, source_listing_id) do update set
          discovery_cell_ids = (
            select array(select distinct e from unnest(
              public.collection_observations.discovery_cell_ids || excluded.discovery_cell_ids) e)
          ),
          discovery_count = public.collection_observations.discovery_count + excluded.discovery_count,
          title = coalesce(public.collection_observations.title, excluded.title),
          rating = coalesce(public.collection_observations.rating, excluded.rating),
          review_count = coalesce(public.collection_observations.review_count, excluded.review_count),
          updated_at = now()
      `;
    }
  }

  async listObservations(collectionId: string): Promise<StoredObservation[]> {
    const rows = await this.sql<ObservationRow[]>`
      select id, collection_id, source_listing_id, source_url, title, area, rating, review_count,
             displayed_price, currency, guest_capacity, bedrooms, latitude, longitude, image_url,
             discovery_cell_ids, discovery_count, detail_collected, detail_observed_status, detail, observed_at
      from public.collection_observations
      where collection_id = ${collectionId}
      order by created_at asc
    `;
    return rows.map(mapObservation);
  }

  async markObservationDetail(
    collectionId: string,
    sourceListingId: string,
    status: StoredObservation["detailObservedStatus"],
    detail: Record<string, unknown> | null,
  ): Promise<void> {
    await this.sql`
      update public.collection_observations
      set detail_collected = ${status === "collected"},
          detail_observed_status = ${status},
          detail = ${detail ? this.sql.json(detail as unknown as JSONValue) : null},
          updated_at = now()
      where collection_id = ${collectionId} and source_listing_id = ${sourceListingId}
    `;
  }

  async createSnapshot(input: SnapshotInput): Promise<string> {
    const rows = await this.sql<{ id: string }[]>`
      insert into public.market_snapshots
        (dataset_id, collection_id, source_id, source_key, market, observation_started_at,
         observation_completed_at, unique_listing_count, search_cell_coverage, completion_percentage,
         quality_status, warning_count, checksum)
      values
        (${input.datasetId}, ${input.collectionId}, ${input.sourceId}, ${input.sourceKey},
         ${input.market}, ${input.observationStartedAt}, ${input.observationCompletedAt},
         ${input.uniqueListingCount}, ${input.searchCellCoverage}, ${input.completionPercentage},
         ${input.qualityStatus}, ${input.warningCount}, ${input.checksum})
      returning id
    `;
    const snapshotId = rows[0]!.id;
    for (const listing of input.listings) {
      await this.sql`
        insert into public.market_snapshot_listings
          (snapshot_id, dataset_id, source_listing_id, source_url, title, area, rating, review_count,
           displayed_price, currency, guest_capacity, bedrooms, latitude, longitude, detail)
        values
          (${snapshotId}, ${input.datasetId}, ${listing.sourceListingId}, ${listing.sourceUrl},
           ${listing.title}, ${listing.area}, ${listing.rating}, ${listing.reviewCount},
           ${listing.displayedPrice}, ${listing.currency}, ${listing.guestCapacity}, ${listing.bedrooms},
           ${listing.latitude}, ${listing.longitude}, ${listing.detail ? this.sql.json(listing.detail as unknown as JSONValue) : null})
      `;
    }
    return snapshotId;
  }

  async listSnapshotListings(
    snapshotId: string,
  ): Promise<SnapshotListingInput[]> {
    const rows = await this.sql<SnapshotListingRow[]>`
      select source_listing_id, source_url, title, area, rating, review_count,
             displayed_price, currency, guest_capacity, bedrooms, latitude, longitude, detail
      from public.market_snapshot_listings
      where snapshot_id = ${snapshotId}
    `;
    return rows.map((row) => ({
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
      detail: (row.detail as Record<string, unknown> | null) ?? null,
    }));
  }

  async recordVerification(
    collectionId: string,
    datasetId: string,
    sourceId: string,
    input: VerificationInput,
  ): Promise<void> {
    await this.sql`
      insert into public.listing_verifications
        (collection_id, dataset_id, source_id, source_listing_id, source_url, status, previous_snapshot_id, observed_at)
      values
        (${collectionId}, ${datasetId}, ${sourceId}, ${input.sourceListingId}, ${input.sourceUrl},
         ${input.status}, ${input.previousSnapshotId}, ${input.observedAt})
    `;
  }
}

interface CollectionRow {
  id: string;
  organization_id: string;
  dataset_id: string;
  source_id: string;
  source_key: string;
  market: string;
  mode: CollectionRecord["mode"];
  state: CollectionRecord["state"];
  headed: boolean;
  collect_details: boolean;
  max_listings: number | null;
  min_rating: number | null;
  min_review_count: number | null;
  selected_areas: string[];
  source_snapshot_id: string | null;
}

interface CellRow {
  id: string;
  collection_id: string;
  parent_area: string;
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
  status: SearchCellStatus;
  listings_discovered: number;
}

interface ObservationRow {
  id: string;
  collection_id: string;
  source_listing_id: string;
  source_url: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  review_count: number | null;
  displayed_price: string | null;
  currency: string | null;
  guest_capacity: number | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  discovery_cell_ids: string[];
  discovery_count: number;
  detail_collected: boolean;
  detail_observed_status: StoredObservation["detailObservedStatus"];
  detail: Record<string, unknown> | null;
  observed_at: string;
}

interface SnapshotListingRow {
  source_listing_id: string;
  source_url: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  review_count: number | null;
  displayed_price: string | null;
  currency: string | null;
  guest_capacity: number | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  detail: unknown;
}

function mapCollection(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    datasetId: row.dataset_id,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    market: row.market,
    mode: row.mode,
    state: row.state,
    headed: row.headed,
    collectDetails: row.collect_details,
    maxListings: row.max_listings,
    minRating: row.min_rating,
    minReviewCount: row.min_review_count,
    selectedAreas: row.selected_areas ?? [],
    sourceSnapshotId: row.source_snapshot_id,
  };
}

function mapCell(row: CellRow): StoredCell {
  return {
    id: row.id,
    collectionId: row.collection_id,
    parentArea: row.parent_area,
    north: Number(row.north),
    south: Number(row.south),
    east: Number(row.east),
    west: Number(row.west),
    zoom: row.zoom,
    status: row.status,
    listingsDiscovered: row.listings_discovered,
  };
}

function mapObservation(row: ObservationRow): StoredObservation {
  return {
    id: row.id,
    sourceListingId: row.source_listing_id,
    sourceUrl: row.source_url,
    title: row.title,
    area: row.area,
    rating: row.rating == null ? null : Number(row.rating),
    reviewCount: row.review_count,
    displayedPrice: row.displayed_price,
    currency: row.currency,
    guestCapacity: row.guest_capacity,
    bedrooms: row.bedrooms,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    imageUrl: row.image_url,
    discoveryCellIds: row.discovery_cell_ids ?? [],
    discoveryCount: row.discovery_count,
    observedAt: row.observed_at,
    detailCollected: row.detail_collected,
    detailObservedStatus: row.detail_observed_status,
    detail: row.detail,
  };
}
