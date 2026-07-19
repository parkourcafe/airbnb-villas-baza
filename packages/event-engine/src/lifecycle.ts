import type {
  Confidence,
  EventType,
  LifecycleStatus,
  ObservationStatus,
} from "@bai/domain";

/**
 * Lifecycle rule version. Stored on every transition and derived event so a
 * later change to thresholds never silently rewrites history (04 §13).
 */
export const LIFECYCLE_RULE_VERSION = "lifecycle-state:v1";

/**
 * Versioned lifecycle thresholds (04 §6). All values are configuration, never
 * hard-coded magic numbers, so a dataset/source can override them under a new
 * version.
 */
export interface LifecycleThresholds {
  version: string;
  /** First miss → suspected: minimum consecutive qualifying misses. */
  suspectedMinMisses: number;
  /** First miss → suspected: minimum hours between first and latest miss. */
  suspectedMinHours: number;
  /** First miss → suspected: minimum distinct collection runs with a miss. */
  suspectedMinRuns: number;
  /** Suspected → confirmed: minimum consecutive qualifying misses. */
  confirmedMinMisses: number;
  /** Suspected → confirmed: minimum calendar-day span of the miss sequence. */
  confirmedMinDays: number;
  /** Whether `unavailable` counts as a (low-weight) qualifying miss (04 §5). */
  countUnavailableAsMiss: boolean;
}

export const DEFAULT_LIFECYCLE_THRESHOLDS: LifecycleThresholds = {
  version: LIFECYCLE_RULE_VERSION,
  suspectedMinMisses: 2,
  suspectedMinHours: 24,
  suspectedMinRuns: 2,
  confirmedMinMisses: 3,
  confirmedMinDays: 7,
  countUnavailableAsMiss: true,
};

/** The accumulated lifecycle projection for a single source listing. */
export interface LifecycleState {
  status: LifecycleStatus;
  confidence: Confidence;
  consecutiveMisses: number;
  lastSeenActiveAt: string | null;
  lastObservedAt: string | null;
  firstMissAt: string | null;
  suspectedInactiveAt: string | null;
  confirmedInactiveAt: string | null;
  reactivatedAt: string | null;
  /** observed_at of the first miss in the current miss sequence. */
  missSequenceStartAt: string | null;
  /** runId of the most recent miss, to count distinct runs. */
  lastMissRunId: string | null;
  /** distinct collection runs that contributed a miss to the sequence. */
  distinctMissRuns: number;
  /** whether the sequence contains a high-confidence direct not_found. */
  highConfidenceNotFoundInSequence: boolean;
  /** monotonic transition counter, used in dedupe keys. */
  transitionSequence: number;
}

export function initialLifecycleState(
  firstObservedAt?: string,
): LifecycleState {
  return {
    status: "active",
    confidence: "low",
    consecutiveMisses: 0,
    lastSeenActiveAt: firstObservedAt ?? null,
    lastObservedAt: firstObservedAt ?? null,
    firstMissAt: null,
    suspectedInactiveAt: null,
    confirmedInactiveAt: null,
    reactivatedAt: null,
    missSequenceStartAt: null,
    lastMissRunId: null,
    distinctMissRuns: 0,
    highConfidenceNotFoundInSequence: false,
    transitionSequence: 0,
  };
}

/** One observation fed to the reducer. */
export interface LifecycleObservation {
  observationStatus: ObservationStatus;
  observedAt: string;
  snapshotId: string;
  runId: string;
  /** A direct high-confidence not-found from an approved adapter (04 §3). */
  highConfidenceNotFound?: boolean;
}

export interface LifecycleContext {
  /** The run is degraded; transitions are suppressed (04 §7). */
  runDegraded?: boolean;
  thresholds?: LifecycleThresholds;
}

/** An evidence-backed lifecycle event proposed by the reducer. */
export interface ProposedEvent {
  eventType: EventType;
  eventAt: string;
  confidence: Confidence;
  dedupeKey: string;
  previousStatus: LifecycleStatus;
  currentStatus: LifecycleStatus;
  snapshotId: string;
  runId: string;
  explanation: string;
  ruleVersion: string;
}

export interface LifecycleResult {
  state: LifecycleState;
  events: ProposedEvent[];
}

const QUALIFYING_DIRECT: ReadonlySet<ObservationStatus> = new Set([
  "not_found",
  "unavailable",
]);

const NON_QUALIFYING: ReadonlySet<ObservationStatus> = new Set([
  "search_not_observed",
  "blocked",
  "source_error",
  "unknown",
]);

function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000;
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

function dedupeKey(
  kind: string,
  listingId: string,
  discriminator: string,
  ruleVersion: string,
): string {
  return `${kind}:${listingId}:${discriminator}:${ruleVersion}`;
}

/**
 * The pure lifecycle reducer (04 §18). Given the prior state, one observation
 * and run context, it returns the next state plus any evidence-backed events.
 * Deterministic and side-effect free: the same inputs always yield the same
 * output, and re-running with the same observation is safe (events carry
 * deterministic dedupe keys, 04 §14).
 */
export function reduceLifecycle(
  state: LifecycleState,
  obs: LifecycleObservation,
  listingId: string,
  context: LifecycleContext = {},
): LifecycleResult {
  const thresholds = context.thresholds ?? DEFAULT_LIFECYCLE_THRESHOLDS;
  const rv = thresholds.version;
  const status = obs.observationStatus;
  const base: LifecycleState = { ...state, lastObservedAt: obs.observedAt };

  // A degraded run may store the snapshot but must never move the lifecycle
  // (04 §7): no miss increments, no inactivity transition.
  if (context.runDegraded) {
    return { state: base, events: [] };
  }

  // Observations that are not evidence about the listing never increment misses
  // (04 §5). `source_error` still surfaces for visibility (LIFE-02).
  if (NON_QUALIFYING.has(status)) {
    const events: ProposedEvent[] = [];
    if (status === "source_error") {
      events.push({
        eventType: "source_error_observed",
        eventAt: obs.observedAt,
        confidence: "low",
        dedupeKey: dedupeKey("source_error", listingId, obs.runId, rv),
        previousStatus: state.status,
        currentStatus: state.status,
        snapshotId: obs.snapshotId,
        runId: obs.runId,
        explanation:
          "The collection run reported a source error for this listing; this is not evidence of inactivity.",
        ruleVersion: rv,
      });
    }
    return { state: base, events };
  }

  if (status === "active") {
    return applyActive(base, state, obs, listingId, rv);
  }

  // Remaining: not_found / unavailable. `unavailable` only counts when configured.
  const qualifies =
    status === "not_found" ||
    (status === "unavailable" && thresholds.countUnavailableAsMiss);
  if (!qualifies || !QUALIFYING_DIRECT.has(status)) {
    return { state: base, events: [] };
  }

  return applyMiss(base, state, obs, listingId, thresholds);
}

function applyActive(
  base: LifecycleState,
  prev: LifecycleState,
  obs: LifecycleObservation,
  listingId: string,
  rv: string,
): LifecycleResult {
  const reset: LifecycleState = {
    ...base,
    consecutiveMisses: 0,
    missSequenceStartAt: null,
    lastMissRunId: null,
    distinctMissRuns: 0,
    highConfidenceNotFoundInSequence: false,
    lastSeenActiveAt: obs.observedAt,
  };

  // Reactivation only from suspected/confirmed inactivity (04 §6/§9.5).
  if (
    prev.status === "suspected_inactive" ||
    prev.status === "confirmed_inactive"
  ) {
    const next: LifecycleState = {
      ...reset,
      status: "reactivated",
      confidence: "high",
      reactivatedAt: obs.observedAt,
      transitionSequence: prev.transitionSequence + 1,
    };
    return {
      state: next,
      events: [
        {
          eventType: "reactivated",
          eventAt: obs.observedAt,
          confidence: "high",
          dedupeKey: dedupeKey(
            "listing_reactivated",
            listingId,
            obs.snapshotId,
            rv,
          ),
          previousStatus: prev.status,
          currentStatus: "reactivated",
          snapshotId: obs.snapshotId,
          runId: obs.runId,
          explanation:
            "A direct active observation followed a period of suspected/confirmed inactivity; the listing is reactivated.",
          ruleVersion: rv,
        },
      ],
    };
  }

  // From first_miss/reactivated/active: simply back to a clean active state.
  return {
    state: { ...reset, status: "active", confidence: "high" },
    events: [],
  };
}

function applyMiss(
  base: LifecycleState,
  prev: LifecycleState,
  obs: LifecycleObservation,
  listingId: string,
  thresholds: LifecycleThresholds,
): LifecycleResult {
  const rv = thresholds.version;
  const misses = prev.consecutiveMisses + 1;
  const sequenceStart = prev.missSequenceStartAt ?? obs.observedAt;
  const newRun = prev.lastMissRunId !== obs.runId;
  const distinctRuns = prev.distinctMissRuns + (newRun ? 1 : 0);
  const highConf =
    prev.highConfidenceNotFoundInSequence ||
    (obs.observationStatus === "not_found" &&
      obs.highConfidenceNotFound === true);

  const working: LifecycleState = {
    ...base,
    consecutiveMisses: misses,
    missSequenceStartAt: sequenceStart,
    lastMissRunId: obs.runId,
    distinctMissRuns: distinctRuns,
    highConfidenceNotFoundInSequence: highConf,
    firstMissAt: prev.firstMissAt ?? obs.observedAt,
  };

  const hours = hoursBetween(sequenceStart, obs.observedAt);
  const days = daysBetween(sequenceStart, obs.observedAt);

  const confirmed =
    misses >= thresholds.confirmedMinMisses &&
    days >= thresholds.confirmedMinDays &&
    highConf &&
    obs.observationStatus === "not_found";
  const suspected =
    misses >= thresholds.suspectedMinMisses &&
    hours >= thresholds.suspectedMinHours &&
    distinctRuns >= thresholds.suspectedMinRuns;

  if (confirmed && prev.status !== "confirmed_inactive") {
    const seq = prev.transitionSequence + 1;
    const next: LifecycleState = {
      ...working,
      status: "confirmed_inactive",
      confidence: "high",
      confirmedInactiveAt: obs.observedAt,
      transitionSequence: seq,
    };
    return {
      state: next,
      events: [
        transitionEvent(
          "confirmed_inactive",
          dedupeKey("listing_confirmed_inactive", listingId, String(seq), rv),
          prev.status,
          "confirmed_inactive",
          obs,
          "high",
          `The listing returned qualifying direct misses across at least ${thresholds.confirmedMinDays} days including a high-confidence not-found; it is likely inactive.`,
          rv,
        ),
      ],
    };
  }

  if (
    suspected &&
    prev.status !== "suspected_inactive" &&
    prev.status !== "confirmed_inactive"
  ) {
    const seq = prev.transitionSequence + 1;
    const next: LifecycleState = {
      ...working,
      status: "suspected_inactive",
      confidence: "medium",
      suspectedInactiveAt: obs.observedAt,
      transitionSequence: seq,
    };
    return {
      state: next,
      events: [
        transitionEvent(
          "suspected_inactive",
          dedupeKey("listing_suspected_inactive", listingId, String(seq), rv),
          prev.status,
          "suspected_inactive",
          obs,
          "medium",
          `The listing returned ${misses} qualifying misses across at least ${thresholds.suspectedMinHours}h in ${distinctRuns} runs; it is suspected inactive.`,
          rv,
        ),
      ],
    };
  }

  // Stay/enter first_miss. Emit the first-miss event only on entry (04 §9.2).
  if (prev.status === "active" || prev.status === "reactivated") {
    const next: LifecycleState = {
      ...working,
      status: "first_miss",
      confidence: "low",
    };
    return {
      state: next,
      events: [
        transitionEvent(
          "first_miss",
          dedupeKey("listing_first_miss", listingId, obs.snapshotId, rv),
          prev.status,
          "first_miss",
          obs,
          "low",
          "The listing returned its first qualifying direct miss; recorded for review, not yet inactive.",
          rv,
        ),
      ],
    };
  }

  // Already first_miss/suspected/confirmed and threshold not (re)crossed: keep
  // the current status, accumulate the miss, emit no duplicate event.
  return { state: { ...working, status: prev.status }, events: [] };
}

function transitionEvent(
  eventType: EventType,
  key: string,
  previousStatus: LifecycleStatus,
  currentStatus: LifecycleStatus,
  obs: LifecycleObservation,
  confidence: Confidence,
  explanation: string,
  ruleVersion: string,
): ProposedEvent {
  return {
    eventType,
    eventAt: obs.observedAt,
    confidence,
    dedupeKey: key,
    previousStatus,
    currentStatus,
    snapshotId: obs.snapshotId,
    runId: obs.runId,
    explanation,
    ruleVersion,
  };
}
