import type { Confidence, EventType } from "@bai/domain";
import type { FieldDiff } from "@bai/snapshot-engine";
import { eventDedupeKey } from "./dedupe";

/** A material field-change event derived from a snapshot diff (04 §9.6/§10). */
export interface FieldChangeEvent {
  eventType: EventType;
  fieldName: string;
  eventAt: string;
  confidence: Confidence;
  dedupeKey: string;
  previousValue: unknown;
  currentValue: unknown;
  explanation: string;
  ruleVersion: string;
}

export interface FieldEventContext {
  sourceListingId: string;
  runId: string;
  observedAt: string;
  /** rule version tag; defaults to the diff's own rule_version. */
  ruleVersion?: string;
}

const CHANNEL_FIELDS = new Set([
  "official_website",
  "business_whatsapp",
  "direct_booking_url",
]);

function eventTypeForField(diff: FieldDiff): EventType | null {
  switch (diff.fieldName) {
    case "price":
      return "price_changed";
    case "rating":
      return "rating_changed";
    case "review_count":
      return "review_count_changed";
    case "host_external_id":
      return "host_changed";
    default:
      // Direct channels raise an event only when a channel is *added* (04 §10.9).
      if (CHANNEL_FIELDS.has(diff.fieldName) && diff.changeKind === "added") {
        return "direct_channel_added";
      }
      return null;
  }
}

function explanationFor(diff: FieldDiff, type: EventType): string {
  switch (type) {
    case "price_changed":
      return "Observed price changed under comparable observation conditions.";
    case "rating_changed":
      return "Observed rating changed between comparable snapshots.";
    case "review_count_changed":
      return "Observed review count increased between comparable snapshots.";
    case "host_changed":
      return "Observed host identifier changed; this does not assert a property sale or management change.";
    case "direct_channel_added":
      return `A direct channel (${diff.fieldName}) was observed; source attribution required.`;
    default:
      return "Observed field change.";
  }
}

/**
 * Derive visible field-change events from a set of snapshot diffs. Only material
 * diffs produce events (EVT-03: a sub-threshold change is stored as a
 * non-material diff but not surfaced). Each event carries a deterministic
 * dedupe key so re-running never duplicates it (04 §14, LIFE-08/EVT tests).
 */
export function fieldChangeEvents(
  diffs: readonly FieldDiff[],
  ctx: FieldEventContext,
): FieldChangeEvent[] {
  const events: FieldChangeEvent[] = [];
  for (const diff of diffs) {
    if (!diff.isMaterial) continue;
    const eventType = eventTypeForField(diff);
    if (!eventType) continue;
    const ruleVersion = ctx.ruleVersion ?? diff.ruleVersion;
    events.push({
      eventType,
      fieldName: diff.fieldName,
      eventAt: ctx.observedAt,
      confidence: "high",
      dedupeKey: eventDedupeKey({
        sourceListingId: ctx.sourceListingId,
        eventType,
        runId: ctx.runId,
        ruleVersion,
      }),
      previousValue: diff.previousValue,
      currentValue: diff.currentValue,
      explanation: explanationFor(diff, eventType),
      ruleVersion,
    });
  }
  return events;
}

/** Thresholds that classify a collection run as degraded (04 §7). */
export interface RunHealthConfig {
  version: string;
  /** Minimum ratio of this run's valid count to the previous run's. */
  minValidRatio: number;
  /** Maximum tolerated source-error rate. */
  maxErrorRate: number;
  /** Maximum tolerated blocked rate. */
  maxBlockedRate: number;
}

export const DEFAULT_RUN_HEALTH: RunHealthConfig = {
  version: "run-health:v1",
  minValidRatio: 0.7,
  maxErrorRate: 0.15,
  maxBlockedRate: 0.05,
};

export interface RunHealthInput {
  totalObservations: number;
  validObservations: number;
  errorObservations: number;
  blockedObservations: number;
  /** Valid count of the comparable previous run, if any. */
  previousValidObservations?: number;
}

export interface RunHealthResult {
  degraded: boolean;
  reasons: string[];
  errorRate: number;
  blockedRate: number;
  validRatio: number | null;
}

/**
 * Assess whether a run is degraded (04 §7, 05 §5.2). A degraded run may store
 * snapshots but must not drive lifecycle transitions — the caller passes
 * `degraded` into the lifecycle reducer's context.
 */
export function assessRunHealth(
  input: RunHealthInput,
  config: RunHealthConfig = DEFAULT_RUN_HEALTH,
): RunHealthResult {
  const total = Math.max(0, input.totalObservations);
  const errorRate = total === 0 ? 0 : input.errorObservations / total;
  const blockedRate = total === 0 ? 0 : input.blockedObservations / total;
  const validRatio =
    input.previousValidObservations && input.previousValidObservations > 0
      ? input.validObservations / input.previousValidObservations
      : null;

  const reasons: string[] = [];
  if (validRatio !== null && validRatio < config.minValidRatio) {
    reasons.push("valid_observation_drop");
  }
  if (errorRate > config.maxErrorRate) reasons.push("source_error_spike");
  if (blockedRate > config.maxBlockedRate) reasons.push("blocked_spike");

  return {
    degraded: reasons.length > 0,
    reasons,
    errorRate,
    blockedRate,
    validRatio,
  };
}
