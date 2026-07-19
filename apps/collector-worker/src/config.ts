import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/**
 * Collector configuration. The live headed browser is OFF unless
 * `AIRBNB_LIVE_COLLECTOR_ENABLED=true`; without it the collector runs only the
 * mock adapter, so tests and dry-runs never touch the network. Airbnb
 * credentials are NEVER read from the environment or stored — session state
 * lives only in the local persistent browser profile the operator controls.
 */
const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const collectorEnvSchema = z.object({
  WORKER_ID: z.string().min(1).default("collector-local"),
  SUPABASE_DB_URL: z.string().url().optional(),
  // Live headed-browser collection is disabled by default (feature flag).
  AIRBNB_LIVE_COLLECTOR_ENABLED: boolFromEnv,
  // Persistent browser profile directory (session state only; no credentials).
  COLLECTOR_PROFILE_DIR: z.string().optional(),
  // Conservative pacing between page actions, in milliseconds.
  COLLECTOR_ACTION_DELAY_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(1500),
  COLLECTOR_SEARCH_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .max(4)
    .default(1),
  COLLECTOR_DETAIL_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .max(4)
    .default(1),
  COLLECTOR_RETRY_LIMIT: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(5)
    .default(2),
  COLLECTOR_HEADLESS: boolFromEnv, // default false => headed
});

export interface CollectorConfig {
  workerId: string;
  databaseUrl?: string;
  liveEnabled: boolean;
  profileDir: string;
  actionDelayMs: number;
  searchConcurrency: number;
  detailConcurrency: number;
  retryLimit: number;
  /** Headed by default; only true if explicitly requested. */
  headless: boolean;
}

export function loadCollectorConfig(
  env: NodeJS.ProcessEnv = process.env,
): CollectorConfig {
  const parsed = collectorEnvSchema.parse(env);
  return {
    workerId: parsed.WORKER_ID,
    databaseUrl: parsed.SUPABASE_DB_URL,
    liveEnabled: parsed.AIRBNB_LIVE_COLLECTOR_ENABLED,
    profileDir:
      parsed.COLLECTOR_PROFILE_DIR ??
      join(homedir(), ".bai-collector", "profile"),
    actionDelayMs: parsed.COLLECTOR_ACTION_DELAY_MS,
    searchConcurrency: parsed.COLLECTOR_SEARCH_CONCURRENCY,
    detailConcurrency: parsed.COLLECTOR_DETAIL_CONCURRENCY,
    retryLimit: parsed.COLLECTOR_RETRY_LIMIT,
    headless: parsed.COLLECTOR_HEADLESS,
  };
}

export function hasDatabase(config: CollectorConfig): boolean {
  return Boolean(config.databaseUrl);
}
