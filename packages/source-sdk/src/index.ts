/**
 * `@bai/source-sdk` - the safe extension point for approved data sources.
 *
 * Milestone 0 ships the contract types, the compliance gate and the registry.
 * Concrete adapters (fixture, manual CSV) are implemented in milestone 8 and are
 * never allowed to run without passing {@link assertSourceExecutionAllowed}.
 */
export * from "./types";
export * from "./compliance";
export * from "./registry";
export * from "./validate";
export * from "./adapters/fixture";
export * from "./adapters/csv";
