/**
 * `@bai/event-engine` - lifecycle state machine, evidence-backed events and
 * run-health assessment.
 *
 * Milestone 0 provided the rule-version marker and deterministic dedupe key;
 * milestone 5 adds the pure lifecycle reducer (04 §18), material field-change
 * event derivation, and degraded-run detection.
 */
export * from "./dedupe";
export * from "./lifecycle";
export * from "./events";
