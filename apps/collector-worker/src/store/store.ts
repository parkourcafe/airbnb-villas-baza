import type { SearchCell } from "@bai/collector-core";
import type {
  CollectionJobState,
  CollectionMode,
  DetailObservedStatus,
  ListingVerificationStatus,
  ManualActionReason,
  SearchCellStatus,
  SnapshotQualityStatus,
} from "@bai/domain";

/** The fields of a claimed collection the runner needs. */
export interface CollectionRecord {
  id: string;
  organizationId: string;
  datasetId: string;
  sourceId: string;
  sourceKey: string;
  market: string;
  mode: CollectionMode;
  state: CollectionJobState;
  headed: boolean;
  collectDetails: boolean;
  maxListings: number | null;
  minRating: number | null;
  minReviewCount: number | null;
  selectedAreas: string[];
  sourceSnapshotId: string | null;
}

export interface StoredCell {
  id: string;
  collectionId: string;
  parentArea: string;
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
  status: SearchCellStatus;
  listingsDiscovered: number;
}

export interface ObservationInput {
  sourceListingId: string;
  sourceUrl: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  reviewCount: number | null;
  displayedPrice: string | null;
  currency: string | null;
  guestCapacity: number | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  discoveryCellIds: string[];
  discoveryCount: number;
  observedAt: string;
}

export interface StoredObservation extends ObservationInput {
  id: string;
  detailCollected: boolean;
  detailObservedStatus: DetailObservedStatus | null;
  detail: Record<string, unknown> | null;
}

export interface SnapshotListingInput {
  sourceListingId: string;
  sourceUrl: string | null;
  title: string | null;
  area: string | null;
  rating: number | null;
  reviewCount: number | null;
  displayedPrice: string | null;
  currency: string | null;
  guestCapacity: number | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  detail: Record<string, unknown> | null;
}

export interface SnapshotInput {
  datasetId: string;
  collectionId: string;
  sourceId: string;
  sourceKey: string;
  market: string;
  observationStartedAt: string | null;
  observationCompletedAt: string | null;
  uniqueListingCount: number;
  searchCellCoverage: number;
  completionPercentage: number;
  qualityStatus: SnapshotQualityStatus;
  warningCount: number;
  checksum: string;
  listings: SnapshotListingInput[];
}

export interface MetricsUpdate {
  planned_cells?: number;
  completed_cells?: number;
  cards_discovered?: number;
  unique_listings?: number;
  duplicate_discoveries?: number;
  detail_pages_completed?: number;
  warning_count?: number;
  error_count?: number;
  current_area?: string | null;
  current_cell?: string | null;
}

export interface SetStateOptions {
  manualActionReason?: ManualActionReason | null;
  manualActionDetail?: string | null;
  finished?: boolean;
}

export interface VerificationInput {
  sourceListingId: string;
  sourceUrl: string | null;
  status: ListingVerificationStatus;
  previousSnapshotId: string | null;
  observedAt: string;
}

/**
 * Persistence boundary for the collector. The runner depends only on this
 * interface; `PgCollectorStore` backs it with Postgres in production and
 * `InMemoryCollectorStore` backs it in tests.
 */
export interface CollectorStore {
  claimCollection(workerId: string): Promise<CollectionRecord | null>;
  getCollection(collectionId: string): Promise<CollectionRecord | null>;
  setState(
    collectionId: string,
    state: CollectionJobState,
    options?: SetStateOptions,
  ): Promise<void>;
  heartbeat(
    collectionId: string,
    workerId: string,
    metrics: MetricsUpdate,
  ): Promise<void>;
  insertSearchCells(
    collectionId: string,
    datasetId: string,
    cells: readonly SearchCell[],
  ): Promise<StoredCell[]>;
  listCells(collectionId: string): Promise<StoredCell[]>;
  updateCellStatus(
    cellId: string,
    status: SearchCellStatus,
    options?: {
      listingsDiscovered?: number;
      started?: boolean;
      completed?: boolean;
    },
  ): Promise<void>;
  upsertObservations(
    collectionId: string,
    datasetId: string,
    sourceId: string,
    observations: readonly ObservationInput[],
  ): Promise<void>;
  listObservations(collectionId: string): Promise<StoredObservation[]>;
  markObservationDetail(
    collectionId: string,
    sourceListingId: string,
    status: DetailObservedStatus,
    detail: Record<string, unknown> | null,
  ): Promise<void>;
  createSnapshot(input: SnapshotInput): Promise<string>;
  listSnapshotListings(snapshotId: string): Promise<SnapshotListingInput[]>;
  recordVerification(
    collectionId: string,
    datasetId: string,
    sourceId: string,
    input: VerificationInput,
  ): Promise<void>;
}
