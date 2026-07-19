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
});

export interface WorkerConfig {
  workerId: string;
  pollIntervalMs: number;
  concurrency: number;
}

export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  const parsed = workerEnvSchema.parse(env);
  return {
    workerId: parsed.WORKER_ID,
    pollIntervalMs: parsed.WORKER_POLL_INTERVAL_MS,
    concurrency: parsed.WORKER_CONCURRENCY,
  };
}
