/**
 * `@bai/event-engine` - materiality, lifecycle state machine and events.
 *
 * Milestone 0 provides the rule-version marker and the deterministic event
 * deduplication key. The lifecycle reducer, materiality config and event
 * generation are implemented in milestones 4-5.
 */
export * from "./dedupe";
