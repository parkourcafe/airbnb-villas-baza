import { describe, expect, it, vi } from "vitest";
import { runWorker } from "../src/worker";
import { loadWorkerConfig } from "../src/config";

describe("worker smoke", () => {
  it("loads config with safe defaults", () => {
    const config = loadWorkerConfig({});
    expect(config.workerId).toBe("worker-local");
    expect(config.pollIntervalMs).toBeGreaterThan(0);
    expect(config.concurrency).toBeGreaterThan(0);
  });

  it("runs a single cycle in smoke mode and exits with code 0", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const code = await runWorker({
      smoke: true,
      config: { workerId: "test-worker", pollIntervalMs: 5000, concurrency: 1 },
    });
    expect(code).toBe(0);
    infoSpy.mockRestore();
  });
});
