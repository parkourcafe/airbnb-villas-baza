import type { JSONValue, TransactionSql } from "postgres";
import type { Confidence, EventType, LifecycleStatus } from "@bai/domain";
import type { LifecycleState } from "@bai/event-engine";
import { initialLifecycleState } from "@bai/event-engine";

/**
 * Map the engine's source-agnostic event vocabulary (`@bai/domain` EventType) to
 * the authoritative `app.event_type` enum, whose lifecycle members are prefixed
 * `listing_*`. Keeping the mapping explicit lets the engine stay database-free.
 */
export const EVENT_TYPE_DB: Record<EventType, string> = {
  listing_created: "listing_created",
  price_changed: "price_changed",
  rating_changed: "rating_changed",
  review_count_changed: "review_count_changed",
  host_changed: "host_changed",
  direct_channel_added: "direct_channel_added",
  first_miss: "listing_first_miss",
  suspected_inactive: "listing_suspected_inactive",
  confirmed_inactive: "listing_confirmed_inactive",
  reactivated: "listing_reactivated",
  source_error_observed: "source_error",
};

const EVENT_TITLE: Record<EventType, string> = {
  listing_created: "Listing first observed",
  price_changed: "Observed price changed",
  rating_changed: "Observed rating changed",
  review_count_changed: "Observed review count changed",
  host_changed: "Observed host identifier changed",
  direct_channel_added: "Direct channel observed",
  first_miss: "First qualifying miss",
  suspected_inactive: "Suspected inactive",
  confirmed_inactive: "Likely inactive",
  reactivated: "Reactivated",
  source_error_observed: "Source error observed",
};

const asJson = (value: unknown): JSONValue => (value ?? null) as JSONValue;

/** A row from `source_listings` carrying the lifecycle projection + aux state. */
export interface LifecycleListingRow {
  current_lifecycle_status: string | null;
  current_confidence: string | null;
  consecutive_misses: number;
  last_seen_active_at: string | null;
  last_observed_at: string | null;
  first_miss_at: string | null;
  suspected_inactive_at: string | null;
  confirmed_inactive_at: string | null;
  reactivated_at: string | null;
  lifecycle_state: Record<string, unknown> | null;
}

/** Reconstruct the reducer state from a persisted listing row. */
export function stateFromRow(row: LifecycleListingRow): LifecycleState {
  const aux = row.lifecycle_state ?? {};
  return {
    status: (row.current_lifecycle_status as LifecycleStatus) ?? "active",
    confidence: (row.current_confidence as Confidence) ?? "low",
    consecutiveMisses: row.consecutive_misses ?? 0,
    lastSeenActiveAt: row.last_seen_active_at,
    lastObservedAt: row.last_observed_at,
    firstMissAt: row.first_miss_at,
    suspectedInactiveAt: row.suspected_inactive_at,
    confirmedInactiveAt: row.confirmed_inactive_at,
    reactivatedAt: row.reactivated_at,
    missSequenceStartAt: (aux.missSequenceStartAt as string) ?? null,
    lastMissRunId: (aux.lastMissRunId as string) ?? null,
    distinctMissRuns: (aux.distinctMissRuns as number) ?? 0,
    highConfidenceNotFoundInSequence:
      (aux.highConfidenceNotFoundInSequence as boolean) ?? false,
    transitionSequence: (aux.transitionSequence as number) ?? 0,
  };
}

/** The default state for a listing that has just been created. */
export function newListingState(firstObservedAt: string): LifecycleState {
  return initialLifecycleState(firstObservedAt);
}

/** The jsonb blob persisted alongside the authoritative lifecycle columns. */
export function auxState(state: LifecycleState): JSONValue {
  return {
    missSequenceStartAt: state.missSequenceStartAt,
    lastMissRunId: state.lastMissRunId,
    distinctMissRuns: state.distinctMissRuns,
    highConfidenceNotFoundInSequence: state.highConfidenceNotFoundInSequence,
    transitionSequence: state.transitionSequence,
  } as JSONValue;
}

export interface EventInput {
  datasetId: string;
  propertyId: string;
  sourceListingId: string;
  eventType: EventType;
  eventAt: string;
  confidence: Confidence;
  dedupeKey: string;
  summary: string;
  previousValue?: unknown;
  currentValue?: unknown;
  ruleVersion: string;
}

export interface EvidenceInput {
  previousSnapshotId?: string | null;
  currentSnapshotId?: string | null;
  collectionRunId?: string | null;
  evidenceType: string;
  explanation: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert an evidence-backed event, de-duplicated on its deterministic key
 * (04 §14). When the event is new, its evidence row is written too; a duplicate
 * key is a no-op so re-processing never creates a second event (LIFE-08/EVT).
 */
export async function insertEvent(
  tx: TransactionSql,
  event: EventInput,
  evidence: EvidenceInput,
): Promise<boolean> {
  const rows = await tx<{ id: string }[]>`
    insert into public.events
      (dataset_id, property_id, source_listing_id, event_type, event_at, confidence,
       title, summary, previous_value, current_value, rule_version, deduplication_key)
    values
      (${event.datasetId}, ${event.propertyId}, ${event.sourceListingId},
       ${EVENT_TYPE_DB[event.eventType]}, ${event.eventAt}, ${event.confidence},
       ${EVENT_TITLE[event.eventType]}, ${event.summary},
       ${tx.json(asJson(event.previousValue))}, ${tx.json(asJson(event.currentValue))},
       ${event.ruleVersion}, ${event.dedupeKey})
    on conflict (deduplication_key) do nothing
    returning id
  `;
  const eventId = rows[0]?.id;
  if (!eventId) return false; // duplicate — evidence already recorded.

  await tx`
    insert into public.event_evidence
      (event_id, previous_snapshot_id, current_snapshot_id, collection_run_id,
       evidence_type, explanation, metadata)
    values
      (${eventId}, ${evidence.previousSnapshotId ?? null},
       ${evidence.currentSnapshotId ?? null}, ${evidence.collectionRunId ?? null},
       ${evidence.evidenceType}, ${evidence.explanation},
       ${tx.json((evidence.metadata ?? {}) as JSONValue)})
  `;
  return true;
}
