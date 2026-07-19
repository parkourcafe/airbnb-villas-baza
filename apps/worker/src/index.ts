import { runWorker } from "./worker";
import { logger } from "./observability/logger";

const smoke = process.argv.includes("--smoke");

runWorker({ smoke })
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    logger.error("worker.fatal", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
