import { describe, expect, it } from "vitest";
import { withRetry } from "../src/runner/pacing";
import { loadCollectorConfig } from "../src/config";

const pacing = { actionDelayMs: 0, retryLimit: 2, sleep: async () => {} };

describe("withRetry", () => {
  it("retries a transient failure then succeeds within the retry limit", async () => {
    let attempts = 0;
    const value = await withRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient");
      return "ok";
    }, pacing);
    expect(value).toBe("ok");
    expect(attempts).toBe(3); // initial + 2 retries
  });

  it("gives up after exhausting the retry limit", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new Error("always fails");
      }, pacing),
    ).rejects.toThrow("always fails");
    expect(attempts).toBe(3);
  });
});

describe("collector config", () => {
  it("keeps live collection disabled and headed by default", () => {
    const config = loadCollectorConfig({} as NodeJS.ProcessEnv);
    expect(config.liveEnabled).toBe(false);
    expect(config.headless).toBe(false);
    expect(config.searchConcurrency).toBe(1);
    expect(config.detailConcurrency).toBe(1);
    expect(config.retryLimit).toBe(2);
  });

  it("enables live collection only with the explicit flag", () => {
    const config = loadCollectorConfig({
      AIRBNB_LIVE_COLLECTOR_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    expect(config.liveEnabled).toBe(true);
  });
});
