import { randomUUID } from "node:crypto";
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

interface SnapshotRecord extends SnapshotInput {
  id: string;
  createdAt: string;
}

/** Stored observation plus the collection it belongs to (internal bookkeeping). */
type InternalObservation = StoredObservation & { collectionId: string };

/**
 * A faithful in-memory model of the browser-collection tables, used by the
 * end-to-end test so the full runner (claim → plan → collect → dedup → enrich →
 * snapshot → resume) can be exercised without a live database. Its public
 * getters mirror what the dashboard reads back.
 */
export class InMemoryCollectorStore implements CollectorStore {
  readonly collections = new Map<string, CollectionRecord>();
  readonly metrics = new Map<string, Required<MetricsUpdate>>();
  readonly cells = new Map<string, StoredCell>();
  readonly observations = new Map<string, InternalObservation>();
  readonly snapshots = new Map<string, SnapshotRecord>();
  readonly snapshotListings = new Map<string, SnapshotListingInput[]>();
  readonly verifications: VerificationInput[] = [];
  private queue: string[] = [];

  seedCollection(record: CollectionRecord): void {
    this.collections.set(record.id, record);
    this.metrics.set(record.id, emptyMetrics());
    if (record.state === "queued") this.queue.push(record.id);
  }

  seedSnapshotListings(
    snapshotId: string,
    listings: SnapshotListingInput[],
  ): void {
    this.snapshotListings.set(snapshotId, listings);
  }

  metricsFor(collectionId: string): Required<MetricsUpdate> {
    return this.metrics.get(collectionId) ?? emptyMetrics();
  }

  observationsFor(collectionId: string): StoredObservation[] {
    return [...this.observations.values()].filter(
      (o) => o.collectionId === collectionId,
    );
  }

  snapshotsFor(collectionId: string): SnapshotRecord[] {
    return [...this.snapshots.values()].filter(
      (s) => s.collectionId === collectionId,
    );
  }

  async claimCollection(workerId: string): Promise<CollectionRecord | null> {
    const id = this.queue.shift();
    if (!id) return null;
    const record = this.collections.get(id);
    if (!record) return null;
    record.state = "claimed";
    void workerId;
    return record;
  }

  async getCollection(collectionId: string): Promise<CollectionRecord | null> {
    return this.collections.get(collectionId) ?? null;
  }

  async setState(
    collectionId: string,
    state: CollectionJobState,
    _options?: SetStateOptions,
  ): Promise<void> {
    const record = this.collections.get(collectionId);
    if (record) record.state = state;
  }

  async heartbeat(
    collectionId: string,
    _workerId: string,
    update: MetricsUpdate,
  ): Promise<void> {
    const current = this.metrics.get(collectionId) ?? emptyMetrics();
    this.metrics.set(collectionId, { ...current, ...stripUndefined(update) });
  }

  async insertSearchCells(
    collectionId: string,
    _datasetId: string,
    cells: readonly SearchCell[],
  ): Promise<StoredCell[]> {
    const stored: StoredCell[] = [];
    for (const cell of cells) {
      const record: StoredCell = {
        id: randomUUID(),
        collectionId,
        parentArea: cell.parentArea,
        north: cell.north,
        south: cell.south,
        east: cell.east,
        west: cell.west,
        zoom: cell.zoom,
        status: "pending",
        listingsDiscovered: 0,
      };
      this.cells.set(record.id, record);
      stored.push(record);
    }
    return stored;
  }

  async listCells(collectionId: string): Promise<StoredCell[]> {
    return [...this.cells.values()].filter(
      (c) => c.collectionId === collectionId,
    );
  }

  async updateCellStatus(
    cellId: string,
    status: SearchCellStatus,
    options?: { listingsDiscovered?: number },
  ): Promise<void> {
    const cell = this.cells.get(cellId);
    if (!cell) return;
    cell.status = status;
    if (options?.listingsDiscovered != null) {
      cell.listingsDiscovered = options.listingsDiscovered;
    }
  }

  async upsertObservations(
    collectionId: string,
    _datasetId: string,
    _sourceId: string,
    observations: readonly ObservationInput[],
  ): Promise<void> {
    for (const obs of observations) {
      const existing = [...this.observations.values()].find(
        (o) =>
          o.collectionId === collectionId &&
          o.sourceListingId === obs.sourceListingId,
      );
      if (existing) {
        existing.discoveryCount += obs.discoveryCount;
        existing.discoveryCellIds = [
          ...new Set([...existing.discoveryCellIds, ...obs.discoveryCellIds]),
        ];
        existing.title ??= obs.title;
        existing.rating ??= obs.rating;
        existing.reviewCount ??= obs.reviewCount;
      } else {
        const record: InternalObservation = {
          ...obs,
          id: randomUUID(),
          collectionId,
          detailCollected: false,
          detailObservedStatus: null,
          detail: null,
        };
        this.observations.set(record.id, record);
      }
    }
  }

  async listObservations(collectionId: string): Promise<StoredObservation[]> {
    return this.observationsFor(collectionId);
  }

  async markObservationDetail(
    collectionId: string,
    sourceListingId: string,
    status: StoredObservation["detailObservedStatus"],
    detail: Record<string, unknown> | null,
  ): Promise<void> {
    const obs = [...this.observations.values()].find(
      (o) =>
        o.collectionId === collectionId &&
        o.sourceListingId === sourceListingId,
    );
    if (!obs) return;
    obs.detailCollected = status === "collected";
    obs.detailObservedStatus = status;
    obs.detail = detail;
  }

  async createSnapshot(input: SnapshotInput): Promise<string> {
    const id = randomUUID();
    this.snapshots.set(id, {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    });
    this.snapshotListings.set(id, input.listings);
    return id;
  }

  async listSnapshotListings(
    snapshotId: string,
  ): Promise<SnapshotListingInput[]> {
    return this.snapshotListings.get(snapshotId) ?? [];
  }

  async recordVerification(
    _collectionId: string,
    _datasetId: string,
    _sourceId: string,
    input: VerificationInput,
  ): Promise<void> {
    this.verifications.push(input);
  }
}

function emptyMetrics(): Required<MetricsUpdate> {
  return {
    planned_cells: 0,
    completed_cells: 0,
    cards_discovered: 0,
    unique_listings: 0,
    duplicate_discoveries: 0,
    detail_pages_completed: 0,
    warning_count: 0,
    error_count: 0,
    current_area: null,
    current_cell: null,
  };
}

function stripUndefined(update: MetricsUpdate): MetricsUpdate {
  const out: MetricsUpdate = {};
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
