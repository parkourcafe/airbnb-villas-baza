import { createHash } from "node:crypto";
import type { EventType } from "@bai/domain";

/**
 * The rule version governs how diffs are judged material and how lifecycle
 * transitions are decided. Every diff and event records it so historical
 * results remain explainable after the rules evolve.
 */
export const EVENT_ENGINE_RULE_VERSION = "0.0.0-foundation";

/**
 * Deterministic event deduplication key. Reprocessing the same run must never
 * create a duplicate event, so the key is derived only from stable inputs and is
 * independent of wall-clock time (see 02_SYSTEM_ARCHITECTURE section 18).
 */
export function eventDedupeKey(input: {
  sourceListingId: string;
  eventType: EventType;
  runId: string;
  ruleVersion?: string;
}): string {
  const ruleVersion = input.ruleVersion ?? EVENT_ENGINE_RULE_VERSION;
  const canonical = [
    input.sourceListingId,
    input.eventType,
    input.runId,
    ruleVersion,
  ].join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
