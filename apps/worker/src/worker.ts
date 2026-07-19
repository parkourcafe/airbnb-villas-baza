import { loadWorkerConfig, type WorkerConfig } from "./config";
import { logger } from "./observability/logger";

export interface RunWorkerOptions {
  /** Smoke mode runs a single no-op cycle and exits cleanly. */
  smoke?: boolean;
  /** Injectable config for tests; defaults to environment-derived config. */
  config?: WorkerConfig;
}

/**
 * Run the worker. In smoke mode it validates configuration, emits a structured
 * log line and returns exit code 0 - this is the milestone-0 acceptance path.
 *
 * In normal mode it starts a poll loop with graceful shutdown handlers. There is
 * no job queue until milestone 1+, so each cycle is currently a no-op heartbeat.
 */
export async function runWorker(
  options: RunWorkerOptions = {},
): Promise<number> {
  const config = options.config ?? loadWorkerConfig();
  logger.info("worker.start", {
    workerId: config.workerId,
    concurrency: config.concurrency,
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

function runPollLoop(config: WorkerConfig): Promise<void> {
  return new Promise((resolve) => {
    let stopping = false;

    const timer = setInterval(() => {
      if (stopping) return;
      // No queue is wired up before milestone 1; emit a heartbeat only.
      logger.info("worker.heartbeat", { workerId: config.workerId });
    }, config.pollIntervalMs);

    const shutdown = (signal: string) => {
      if (stopping) return;
      stopping = true;
      clearInterval(timer);
      logger.info("worker.shutdown", { workerId: config.workerId, signal });
      resolve();
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });
}
