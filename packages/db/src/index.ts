/**
 * `@bai/db` - database access layer.
 *
 * Milestone 1 adds the Supabase Data API contract (generated-style types),
 * lazy environment validation, the server-only service client and
 * authorization-aware tenancy repositories. Browser/server SSR clients live in
 * the web app (they depend on Next's cookie store).
 */
export * from "./lazy";
export * from "./pagination";
export * from "./env";
export * from "./clients/service";
export * from "./repositories/tenancy";
export * from "./repositories/catalogue";
export * from "./repositories/imports";
export * from "./repositories/events";
export * from "./repositories/leads";
export type { Database, Json } from "./generated/database.types";
