/**
 * `@bai/snapshot-engine` - immutable snapshots, fingerprints and deterministic
 * field diffs.
 *
 * Milestone 0 provided the normalization/hashing primitives; milestone 4 adds
 * URL/boolean/number/set normalization, snapshot fingerprinting with
 * field_presence + quality_flags, comparable-snapshot selection, versioned
 * materiality, and the per-field-type diff engine.
 */
export * from "./normalize";
export * from "./fields";
export * from "./materiality";
export * from "./snapshot";
export * from "./selection";
export * from "./diff";
