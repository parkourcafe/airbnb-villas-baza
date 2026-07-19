import { z } from "zod";

/**
 * Worker configuration, validated from the environment with Zod so the process
 * fails fast on misconfiguration. Read lazily (never at import time) so importing
 * this module has no side effects.
 */
const workerEnvSchema = z.object({
  WORKER_ID: z.string().min(1).default("worker-local"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(64).default(2),
  // Optional: without these the worker runs but processes no jobs (e.g. smoke).
  SUPABASE_DB_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export interface WorkerConfig {
  workerId: string;
  pollIntervalMs: number;
  concurrency: number;
  databaseUrl?: string;
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  const parsed = workerEnvSchema.parse(env);
  return {
    workerId: parsed.WORKER_ID,
    pollIntervalMs: parsed.WORKER_POLL_INTERVAL_MS,
    concurrency: parsed.WORKER_CONCURRENCY,
    databaseUrl: parsed.SUPABASE_DB_URL,
    supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** True when the worker has enough configuration to process jobs. */
export function canProcessJobs(config: WorkerConfig): boolean {
  return Boolean(config.databaseUrl);
}
