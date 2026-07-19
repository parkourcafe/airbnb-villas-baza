import type { Sql } from "postgres";
import {
  CsvSourceAdapter,
  FixtureSourceAdapter,
  SourceRegistry,
} from "@bai/source-sdk";
import { canProcessJobs, loadWorkerConfig, type WorkerConfig } from "./config";
import { logger } from "./observability/logger";
import { closeSql, getSql } from "./db";
import {
  claimJob,
  completeJob,
  recoverStaleJobs,
  type CollectionJob,
} from "./jobs/queue";
import { runImportJob } from "./jobs/import-runner";
import { runCollectJob } from "./jobs/collect-runner";
import { runReportJob } from "./jobs/report-runner";
import { createCsvLoader, createCsvUploader } from "./storage";

/**
 * The adapters this worker can run. The `airbnb` source is intentionally never
 * registered with an automated collector in the MVP — it stays seeded disabled.
 */
function buildRegistry(): SourceRegistry {
  const registry = new SourceRegistry();
  registry.register(new FixtureSourceAdapter());
  registry.register(new CsvSourceAdapter());
  return registry;
}

export interface RunWorkerOptions {
  smoke?: boolean;
  config?: WorkerConfig;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Run the worker. Smoke mode validates config, logs and returns 0 (the
 * milestone-0 acceptance path). Normal mode polls the job queue and dispatches
 * claimed jobs; without a database URL it degrades to a heartbeat.
 */
export async function runWorker(
  options: RunWorkerOptions = {},
): Promise<number> {
  const config = options.config ?? loadWorkerConfig();
  logger.info("worker.start", {
    workerId: config.workerId,
    concurrency: config.concurrency,
    processesJobs: canProcessJobs(config),
    smoke: Boolean(options.smoke),
  });

  if (options.smoke) {
    logger.info("worker.smoke.ok", { workerId: config.workerId });
    return 0;
  }

  await runPollLoop(config);
  logger.info("worker.stopped", { workerId: config.workerId });
  return 0;
}

interface JobDeps {
  loadCsv?: (path: string) => Promise<string>;
  uploadCsv?: (path: string, content: string) => Promise<void>;
  registry: SourceRegistry;
}

async function handleJob(
  sql: Sql,
  deps: JobDeps,
  job: CollectionJob,
): Promise<void> {
  logger.info("job.claimed", { jobId: job.id, type: job.job_type });
  try {
    if (job.job_type === "import") {
      if (!deps.loadCsv) {
        throw new Error("import job requires storage configuration");
      }
      await runImportJob({ sql, loadCsv: deps.loadCsv }, job);
    } else if (job.job_type === "collect") {
      await runCollectJob({ sql, registry: deps.registry }, job);
    } else if (job.job_type === "report") {
      if (!deps.uploadCsv) {
        throw new Error("report job requires storage configuration");
      }
      await runReportJob({ sql, uploadCsv: deps.uploadCsv }, job);
    } else {
      logger.warn("job.unsupported", { jobId: job.id, type: job.job_type });
    }
    await completeJob(sql, job.id, "succeeded");
  } catch (error) {
    logger.error("job.failed", { jobId: job.id, message: errorMessage(error) });
    await completeJob(sql, job.id, "failed", errorMessage(error));
  }
}

function runPollLoop(config: WorkerConfig): Promise<void> {
  return new Promise((resolve) => {
    let stopping = false;
    let ticking = false;
    const sql: Sql | undefined = canProcessJobs(config)
      ? getSql(config.databaseUrl as string)
      : undefined;
    const hasStorage = Boolean(config.supabaseUrl && config.serviceRoleKey);
    const jobDeps: JobDeps = {
      loadCsv: hasStorage
        ? createCsvLoader(config.supabaseUrl as string, config.serviceRoleKey as string)
        : undefined,
      uploadCsv: hasStorage
        ? createCsvUploader(config.supabaseUrl as string, config.serviceRoleKey as string)
        : undefined,
      registry: buildRegistry(),
    };

    const tick = async () => {
      if (stopping || ticking) return;
      ticking = true;
      try {
        if (!sql) {
          logger.info("worker.heartbeat", { workerId: config.workerId });
          return;
        }
        await recoverStaleJobs(sql);
        const job = await claimJob(sql, config.workerId);
        if (job) {
          await handleJob(sql, jobDeps, job);
        }
      } catch (error) {
        logger.error("worker.tick.error", { message: errorMessage(error) });
      } finally {
        ticking = false;
      }
    };

    const timer = setInterval(() => {
      void tick();
    }, config.pollIntervalMs);

    const shutdown = (signal: string) => {
      if (stopping) return;
      stopping = true;
      clearInterval(timer);
      void (async () => {
        if (sql) await closeSql();
        logger.info("worker.shutdown", { workerId: config.workerId, signal });
        resolve();
      })();
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });
}
