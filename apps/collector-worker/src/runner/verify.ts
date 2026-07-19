import {
  manualActionReasonForState,
  type PageState,
} from "@bai/collector-core";
import type {
  ListingVerificationStatus,
  ManualActionReason,
} from "@bai/domain";
import { logger } from "../logger";
import type { PageDriver } from "../browser/page-driver";
import { pace, withRetry, type PacingOptions } from "./pacing";
import type { CollectorStore } from "../store/store";

export interface VerifyRunnerDeps {
  store: CollectorStore;
  driver: PageDriver;
  pacing: PacingOptions;
  now?: () => string;
}

export interface VerifyRunResult {
  collectionId: string;
  finalState: string;
  verified: number;
  blocked: boolean;
  manualActionReason: ManualActionReason | null;
}

/**
 * Verify a previous snapshot's listings are still present. Each listing gets a
 * per-listing status; a single inconclusive observation (login_required,
 * blocked, source_error, unknown) is NEVER interpreted as a removal. A blocking
 * page stops the job for manual intervention (the block usually affects every
 * listing, so continuing is pointless).
 */
export async function runVerification(
  deps: VerifyRunnerDeps,
  collectionId: string,
  workerId: string,
): Promise<VerifyRunResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const { store, driver } = deps;

  const collection = await store.getCollection(collectionId);
  if (!collection) throw new Error(`collection ${collectionId} not found`);
  await store.setState(collectionId, "running");

  if (!collection.sourceSnapshotId) {
    await store.setState(collectionId, "failed", { finished: true });
    logger.warn("verify.no_source_snapshot", { collection: collectionId });
    return {
      collectionId,
      finalState: "failed",
      verified: 0,
      blocked: false,
      manualActionReason: null,
    };
  }

  const listings = await store.listSnapshotListings(
    collection.sourceSnapshotId,
  );
  let verified = 0;
  let blocked = false;
  let manualReason: ManualActionReason | null = null;

  await driver.launch();
  try {
    for (const listing of listings) {
      await store.heartbeat(collectionId, workerId, {
        current_area: listing.area ?? null,
        current_cell: null,
      });

      let state: PageState = "navigation_error";
      let observedStatus: string | undefined;
      try {
        const result = await withRetry(
          () =>
            driver.collectDetail(listing.sourceListingId, listing.sourceUrl),
          deps.pacing,
        );
        state = result.state;
        observedStatus = result.detail?.observedStatus;
      } catch (error) {
        logger.warn("verify.error", {
          listing: listing.sourceListingId,
          message: error instanceof Error ? error.message : String(error),
        });
        state = "navigation_error";
      }
      await pace(deps.pacing);

      const status = toVerificationStatus(state, observedStatus);
      await store.recordVerification(
        collectionId,
        collection.datasetId,
        collection.sourceId,
        {
          sourceListingId: listing.sourceListingId,
          sourceUrl: listing.sourceUrl,
          status,
          previousSnapshotId: collection.sourceSnapshotId,
          observedAt: now(),
        },
      );
      verified += 1;
      await store.heartbeat(collectionId, workerId, {
        detail_pages_completed: verified,
      });

      if (isBlocking(state)) {
        blocked = true;
        manualReason = manualActionReasonForState(state);
        break;
      }
    }
  } finally {
    await driver.close();
  }

  const finalState = blocked ? "manual_action_required" : "completed";
  await store.setState(collectionId, finalState, {
    manualActionReason: manualReason,
    finished: !blocked,
  });
  logger.info("verify.finished", {
    collection: collectionId,
    verified,
    state: finalState,
  });

  return {
    collectionId,
    finalState,
    verified,
    blocked,
    manualActionReason: manualReason,
  };
}

const BLOCKING_STATES: readonly PageState[] = [
  "login_challenge",
  "captcha",
  "account_verification",
  "access_denied",
  "blocked",
];

function isBlocking(state: PageState): boolean {
  return BLOCKING_STATES.includes(state) || state === "navigation_error";
}

function toVerificationStatus(
  state: PageState,
  observedStatus: string | undefined,
): ListingVerificationStatus {
  switch (state) {
    case "ok":
      if (observedStatus === "collected") return "active";
      if (observedStatus === "not_found") return "not_found";
      return "unavailable";
    case "no_results":
      return "unavailable";
    case "login_challenge":
    case "account_verification":
      return "login_required";
    case "captcha":
    case "access_denied":
    case "blocked":
      return "blocked";
    case "navigation_error":
      return "source_error";
    default:
      return "unknown";
  }
}
