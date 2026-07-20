import {
  BALI_MARKET,
  computeSnapshotChecksum,
  deriveQualityStatus,
  getMarket,
  manualActionReasonForState,
  planMarketCells,
  searchCellCoverage,
  completionPercentage,
  snapshotListingFingerprint,
  type PageState,
  type RawCard,
} from "@bai/collector-core";
import type { ManualActionReason, SnapshotQualityStatus } from "@bai/domain";
import { logger } from "../logger";
import type { PageDriver } from "../browser/page-driver";
import { pace, withRetry, type PacingOptions } from "./pacing";
import type {
  CollectionRecord,
  CollectorStore,
  ObservationInput,
  SnapshotListingInput,
  StoredObservation,
} from "../store/store";

export interface CollectRunnerDeps {
  store: CollectorStore;
  driver: PageDriver;
  pacing: PacingOptions;
  now?: () => string;
}

export interface CollectRunResult {
  collectionId: string;
  finalState: string;
  blocked: boolean;
  manualActionReason: ManualActionReason | null;
  snapshotId: string | null;
  quality: SnapshotQualityStatus | null;
  uniqueListings: number;
  detailPagesCompleted: number;
}

const BLOCKING_STATES: readonly PageState[] = [
  "login_challenge",
  "captcha",
  "account_verification",
  "access_denied",
  "blocked",
  "navigation_error",
];

function isBlocking(state: PageState): boolean {
  return BLOCKING_STATES.includes(state);
}

/**
 * Run one pass of a browser collection. The pass is resumable: it re-plans only
 * if no cells exist, processes pending cells and pending detail pages, and stops
 * cleanly with `manual_action_required` on any blocking page. A pass that has
 * usable search coverage finalizes an immutable snapshot.
 */
export async function runCollection(
  deps: CollectRunnerDeps,
  collectionId: string,
  workerId: string,
): Promise<CollectRunResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const { store, driver } = deps;

  const collection = await store.getCollection(collectionId);
  if (!collection) throw new Error(`collection ${collectionId} not found`);

  if (collection.mode === "verify_existing_listings") {
    // Verification is a distinct path; handled by the verify runner.
    throw new Error("use runVerification for verify_existing_listings mode");
  }

  await store.setState(collectionId, "running");
  const startedAt = now();

  // 1. Plan search cells (first pass only).
  let cells = await store.listCells(collectionId);
  if (cells.length === 0) {
    const market = getMarket(collection.market) ?? BALI_MARKET;
    const planned = planMarketCells(market, collection.selectedAreas);
    cells = await store.insertSearchCells(
      collectionId,
      collection.datasetId,
      planned,
    );
  }

  // Seed running counters from what is already persisted (resume-safe).
  const existing = await store.listObservations(collectionId);
  const seen = new Set(existing.map((o) => o.sourceListingId));
  let cardsDiscovered = existing.reduce((n, o) => n + o.discoveryCount, 0);
  let duplicates = Math.max(0, cardsDiscovered - existing.length);
  let warnings = 0;
  let errors = 0;
  let blocked = false;
  let manualReason: ManualActionReason | null = null;

  await deps.store.heartbeat(collectionId, workerId, {
    planned_cells: cells.length,
  });

  // 2. Search phase.
  await driver.launch();
  // Keep the browser OPEN when we stop for manual intervention, so the
  // operator can act in the same window instead of it vanishing on them. It is
  // only closed on a clean finish or on a genuine unexpected error.
  let driverClosed = false;
  const closeDriver = async (): Promise<void> => {
    if (driverClosed) return;
    driverClosed = true;
    await driver.close();
  };
  try {
    for (const cell of cells) {
      if (cell.status === "completed" || cell.status === "skipped") continue;
      await store.updateCellStatus(cell.id, "running", { started: true });
      await deps.store.heartbeat(collectionId, workerId, {
        current_area: cell.parentArea,
        current_cell: cell.id,
      });

      let result;
      try {
        result = await withRetry(() => driver.collectSearch(cell), deps.pacing);
      } catch (error) {
        // Repeated transient navigation failure — stop for manual intervention.
        logger.warn("collect.search.error", {
          cell: cell.id,
          message: error instanceof Error ? error.message : String(error),
        });
        await store.updateCellStatus(cell.id, "manual_action_required");
        blocked = true;
        manualReason = "navigation_failure";
        break;
      }
      await pace(deps.pacing);

      if (isBlocking(result.state)) {
        await store.updateCellStatus(cell.id, "manual_action_required");
        blocked = true;
        manualReason = manualActionReasonForState(result.state);
        logger.warn("collect.search.blocked", {
          cell: cell.id,
          state: result.state,
        });
        break;
      }

      warnings += result.malformedCount;
      const kept = result.cards.filter((card) =>
        passesFilters(card, collection),
      );
      const batch: ObservationInput[] = [];
      for (const card of kept) {
        const isNew = !seen.has(card.sourceListingId);
        if (isNew && atCap(collection, seen.size)) continue;
        cardsDiscovered += 1;
        if (isNew) seen.add(card.sourceListingId);
        else duplicates += 1;
        batch.push(toObservationInput(card, cell.id, now()));
      }
      await store.upsertObservations(
        collectionId,
        collection.datasetId,
        collection.sourceId,
        batch,
      );
      await store.updateCellStatus(cell.id, "completed", {
        listingsDiscovered: kept.length,
        completed: true,
      });

      await deps.store.heartbeat(collectionId, workerId, {
        cards_discovered: cardsDiscovered,
        unique_listings: seen.size,
        duplicate_discoveries: duplicates,
        warning_count: warnings,
        completed_cells: await completedCellCount(store, collectionId),
      });
    }

    // 3. Detail enrichment (resumable; skipped when not requested or blocked).
    let detailPagesCompleted = existing.filter((o) => o.detailCollected).length;
    const wantsDetails =
      !blocked &&
      collection.collectDetails &&
      collection.mode === "search_and_details";
    if (wantsDetails) {
      const observations = await store.listObservations(collectionId);
      for (const obs of observations) {
        if (obs.detailCollected) continue;
        await deps.store.heartbeat(collectionId, workerId, {
          current_cell: null,
          current_area: obs.area ?? null,
        });

        let result;
        try {
          result = await withRetry(
            () => driver.collectDetail(obs.sourceListingId, obs.sourceUrl),
            deps.pacing,
          );
        } catch (error) {
          logger.warn("collect.detail.error", {
            listing: obs.sourceListingId,
            message: error instanceof Error ? error.message : String(error),
          });
          errors += 1;
          continue; // one detail failure never blocks the whole job
        }
        await pace(deps.pacing);

        if (isBlocking(result.state)) {
          blocked = true;
          manualReason = manualActionReasonForState(result.state);
          logger.warn("collect.detail.blocked", {
            listing: obs.sourceListingId,
            state: result.state,
          });
          break;
        }

        const detail = result.detail;
        const status = detail?.observedStatus ?? "error";
        await store.markObservationDetail(
          collectionId,
          obs.sourceListingId,
          status,
          detail ? (detail as unknown as Record<string, unknown>) : null,
        );
        if (status === "collected") detailPagesCompleted += 1;
        else warnings += 1;

        await deps.store.heartbeat(collectionId, workerId, {
          detail_pages_completed: detailPagesCompleted,
          warning_count: warnings,
          error_count: errors,
        });
      }
    }

    // 4. Finalize.
    const outcome = await finalize(deps, collection, workerId, {
      startedAt,
      blocked,
      manualReason,
      warnings,
      errors,
      detailPagesCompleted,
    });
    if (outcome.blocked) {
      logger.info("collect.browser.left_open", {
        collection: collectionId,
        reason: outcome.manualActionReason,
      });
    } else {
      await closeDriver();
    }
    return outcome;
  } catch (error) {
    // A genuine unexpected error (not a handled blocking state) — don't leave
    // an orphaned browser window behind.
    await closeDriver();
    throw error;
  }
}

interface FinalizeInput {
  startedAt: string;
  blocked: boolean;
  manualReason: ManualActionReason | null;
  warnings: number;
  errors: number;
  detailPagesCompleted: number;
}

async function finalize(
  deps: CollectRunnerDeps,
  collection: CollectionRecord,
  workerId: string,
  input: FinalizeInput,
): Promise<CollectRunResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const { store } = deps;
  const cells = await store.listCells(collection.id);
  const planned = cells.length;
  const completed = cells.filter((c) => c.status === "completed").length;
  const failed = cells.filter(
    (c) => c.status === "failed" || c.status === "manual_action_required",
  ).length;
  const observations = await store.listObservations(collection.id);

  const detailsRequired =
    collection.collectDetails && collection.mode === "search_and_details";
  const detailsPending =
    detailsRequired && observations.some((o) => !o.detailCollected);

  let quality = deriveQualityStatus({
    plannedCells: planned,
    completedCells: completed,
    failedCells: failed,
    errors: input.errors,
  });
  if (
    (input.blocked || detailsPending || completed < planned) &&
    quality === "complete"
  ) {
    quality = "partial";
  }

  let snapshotId: string | null = null;
  if (completed > 0) {
    const checksum = computeSnapshotChecksum(
      observations.map((o) => snapshotListingFingerprint(toCard(o))),
    );
    snapshotId = await store.createSnapshot({
      datasetId: collection.datasetId,
      collectionId: collection.id,
      sourceId: collection.sourceId,
      sourceKey: collection.sourceKey,
      market: collection.market,
      observationStartedAt: input.startedAt,
      observationCompletedAt: now(),
      uniqueListingCount: observations.length,
      searchCellCoverage: searchCellCoverage(planned, completed),
      completionPercentage: completionPercentage(planned, completed),
      qualityStatus: quality,
      warningCount: input.warnings,
      checksum,
      listings: observations.map(toSnapshotListing),
    });
  }

  const finalState = input.blocked
    ? "manual_action_required"
    : quality === "failed"
      ? "failed"
      : quality === "complete"
        ? "completed"
        : "partial";

  await store.setState(collection.id, finalState, {
    manualActionReason: input.manualReason,
    manualActionDetail: input.blocked
      ? "The collector stopped and needs you to resolve a login/verification page in the browser, then resume."
      : null,
    finished: finalState !== "manual_action_required",
  });
  await store.heartbeat(collection.id, workerId, {
    completed_cells: completed,
    detail_pages_completed: input.detailPagesCompleted,
    unique_listings: observations.length,
    warning_count: input.warnings,
    error_count: input.errors,
  });

  logger.info("collect.pass.finished", {
    collection: collection.id,
    state: finalState,
    quality,
    unique: observations.length,
    details: input.detailPagesCompleted,
    snapshot: snapshotId,
  });

  return {
    collectionId: collection.id,
    finalState,
    blocked: input.blocked,
    manualActionReason: input.manualReason,
    snapshotId,
    quality: completed > 0 ? quality : null,
    uniqueListings: observations.length,
    detailPagesCompleted: input.detailPagesCompleted,
  };
}

async function completedCellCount(
  store: CollectorStore,
  collectionId: string,
): Promise<number> {
  const cells = await store.listCells(collectionId);
  return cells.filter((c) => c.status === "completed").length;
}

function passesFilters(card: RawCard, collection: CollectionRecord): boolean {
  if (
    collection.minRating != null &&
    card.rating != null &&
    card.rating < collection.minRating
  ) {
    return false;
  }
  if (
    collection.minReviewCount != null &&
    card.reviewCount != null &&
    card.reviewCount < collection.minReviewCount
  ) {
    return false;
  }
  return true;
}

function atCap(collection: CollectionRecord, uniqueSoFar: number): boolean {
  return (
    collection.maxListings != null && uniqueSoFar >= collection.maxListings
  );
}

function toObservationInput(
  card: RawCard,
  cellId: string,
  observedAt: string,
): ObservationInput {
  return {
    sourceListingId: card.sourceListingId,
    sourceUrl: card.canonicalUrl,
    title: card.title,
    area: card.area,
    rating: card.rating,
    reviewCount: card.reviewCount,
    displayedPrice: card.displayedPrice,
    currency: card.currency,
    guestCapacity: card.guestCapacity,
    bedrooms: card.bedrooms,
    latitude: card.latitude,
    longitude: card.longitude,
    imageUrl: card.imageUrl,
    discoveryCellIds: [cellId],
    discoveryCount: 1,
    observedAt,
  };
}

function toCard(obs: StoredObservation): RawCard {
  return {
    sourceListingId: obs.sourceListingId,
    canonicalUrl: obs.sourceUrl,
    title: obs.title,
    area: obs.area,
    rating: obs.rating,
    reviewCount: obs.reviewCount,
    displayedPrice: obs.displayedPrice,
    currency: obs.currency,
    guestCapacity: obs.guestCapacity,
    bedrooms: obs.bedrooms,
    imageUrl: obs.imageUrl,
    latitude: obs.latitude,
    longitude: obs.longitude,
    rawPayload: {},
  };
}

function toSnapshotListing(obs: StoredObservation): SnapshotListingInput {
  return {
    sourceListingId: obs.sourceListingId,
    sourceUrl: obs.sourceUrl,
    title: obs.title,
    area: obs.area,
    rating: obs.rating,
    reviewCount: obs.reviewCount,
    displayedPrice: obs.displayedPrice,
    currency: obs.currency,
    guestCapacity: obs.guestCapacity,
    bedrooms: obs.bedrooms,
    latitude: obs.latitude,
    longitude: obs.longitude,
    detail: obs.detail,
  };
}
