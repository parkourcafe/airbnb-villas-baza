/**
 * Conservative pacing + bounded retry for the collector. Ordinary transient
 * errors (a flaky navigation) are retried up to `retryLimit` with exponential
 * backoff. Blocking states (login/CAPTCHA/access-denied) are NOT retried here —
 * they stop the job for manual intervention.
 */
export interface PacingOptions {
  actionDelayMs: number;
  retryLimit: number;
  /** Base backoff; doubles each attempt. */
  backoffBaseMs?: number;
  /** Injectable sleep (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function pace(options: PacingOptions): Promise<void> {
  if (options.actionDelayMs > 0) {
    await (options.sleep ?? defaultSleep)(options.actionDelayMs);
  }
}

/**
 * Run `fn` with bounded retry + exponential backoff. `fn` should throw for a
 * transient error; a thrown error after the last attempt propagates.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: PacingOptions,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const base = options.backoffBaseMs ?? 500;
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retryLimit; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < options.retryLimit) {
        await sleep(base * 2 ** attempt);
      }
    }
  }
  throw lastError;
}
