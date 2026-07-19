import { describe, expect, it } from "vitest";
import {
  initialLifecycleState,
  type LifecycleContext,
  type LifecycleObservation,
  type LifecycleState,
  reduceLifecycle,
} from "./index";

const LISTING = "listing-1";

function obs(
  partial: Partial<LifecycleObservation> & {
    observationStatus: LifecycleObservation["observationStatus"];
    observedAt: string;
  },
): LifecycleObservation {
  return {
    snapshotId: `snap-${partial.observedAt}`,
    runId: `run-${partial.observedAt}`,
    ...partial,
  };
}

function run(
  observations: LifecycleObservation[],
  contexts: LifecycleContext[] = [],
): {
  state: LifecycleState;
  events: ReturnType<typeof reduceLifecycle>["events"];
}[] {
  let state = initialLifecycleState("2026-07-01T00:00:00Z");
  const out: ReturnType<typeof run> = [];
  observations.forEach((o, i) => {
    const result = reduceLifecycle(state, o, LISTING, contexts[i] ?? {});
    state = result.state;
    out.push({ state, events: result.events });
  });
  return out;
}

describe("lifecycle reducer", () => {
  it("LIFE-01: search absence stays active and never increments misses", () => {
    const [r] = run([
      obs({
        observationStatus: "search_not_observed",
        observedAt: "2026-07-02T00:00:00Z",
      }),
    ]);
    expect(r!.state.status).toBe("active");
    expect(r!.state.consecutiveMisses).toBe(0);
    expect(r!.events).toHaveLength(0);
  });

  it("LIFE-02: source error surfaces visibility but no miss/inactivity", () => {
    const [r] = run([
      obs({
        observationStatus: "source_error",
        observedAt: "2026-07-02T00:00:00Z",
      }),
    ]);
    expect(r!.state.status).toBe("active");
    expect(r!.state.consecutiveMisses).toBe(0);
    expect(r!.events[0]?.eventType).toBe("source_error_observed");
  });

  it("LIFE-03: one direct not_found is first_miss only", () => {
    const [r] = run([
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-02T00:00:00Z",
      }),
    ]);
    expect(r!.state.status).toBe("first_miss");
    expect(r!.state.consecutiveMisses).toBe(1);
    expect(r!.events[0]?.eventType).toBe("first_miss");
  });

  it("LIFE-04: a second qualifying miss after 24h across runs is suspected", () => {
    const results = run([
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-02T00:00:00Z",
      }),
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-03T02:00:00Z",
      }),
    ]);
    const last = results[1]!;
    expect(last.state.status).toBe("suspected_inactive");
    expect(last.events).toHaveLength(1);
    expect(last.events[0]?.eventType).toBe("suspected_inactive");
    expect(last.events[0]?.confidence).toBe("medium");
  });

  it("LIFE-05: a third qualifying miss across 7 days with high-conf not_found is confirmed", () => {
    const results = run([
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-02T00:00:00Z",
      }),
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-03T02:00:00Z",
      }),
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-10T00:00:00Z",
        highConfidenceNotFound: true,
      }),
    ]);
    const last = results[2]!;
    expect(last.state.status).toBe("confirmed_inactive");
    expect(last.state.confidence).toBe("high");
    expect(last.events[0]?.eventType).toBe("confirmed_inactive");
  });

  it("LIFE-06: a degraded run stores but does not transition", () => {
    const results = run(
      [
        obs({
          observationStatus: "not_found",
          observedAt: "2026-07-02T00:00:00Z",
        }),
        obs({
          observationStatus: "not_found",
          observedAt: "2026-07-05T00:00:00Z",
        }),
      ],
      [{}, { runDegraded: true }],
    );
    expect(results[1]!.state.status).toBe("first_miss");
    expect(results[1]!.state.consecutiveMisses).toBe(1);
    expect(results[1]!.events).toHaveLength(0);
  });

  it("LIFE-07: an active observation after inactivity reactivates and resets", () => {
    const results = run([
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-02T00:00:00Z",
      }),
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-03T02:00:00Z",
      }),
      obs({ observationStatus: "active", observedAt: "2026-07-04T00:00:00Z" }),
    ]);
    const last = results[2]!;
    expect(last.state.status).toBe("reactivated");
    expect(last.state.consecutiveMisses).toBe(0);
    expect(last.state.lastSeenActiveAt).toBe("2026-07-04T00:00:00Z");
    expect(last.events[0]?.eventType).toBe("reactivated");
  });

  it("LIFE-08: reprocessing the same observation yields an identical dedupe key", () => {
    const state = initialLifecycleState("2026-07-01T00:00:00Z");
    const o = obs({
      observationStatus: "not_found",
      observedAt: "2026-07-02T00:00:00Z",
    });
    const a = reduceLifecycle(state, o, LISTING);
    const b = reduceLifecycle(state, o, LISTING);
    expect(a.events[0]?.dedupeKey).toBe(b.events[0]?.dedupeKey);
    expect(a.state).toEqual(b.state);
  });

  it("LIFE-09: an active observation between misses resets the sequence", () => {
    const results = run([
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-02T00:00:00Z",
      }),
      obs({ observationStatus: "active", observedAt: "2026-07-03T00:00:00Z" }),
      obs({
        observationStatus: "not_found",
        observedAt: "2026-07-04T00:00:00Z",
      }),
    ]);
    // After the reset, the trailing miss is a fresh first_miss, not suspected.
    expect(results[2]!.state.status).toBe("first_miss");
    expect(results[2]!.state.consecutiveMisses).toBe(1);
  });

  it("LIFE-10: repeated unavailable never instantly confirms without direct not_found", () => {
    const results = run([
      obs({
        observationStatus: "unavailable",
        observedAt: "2026-07-02T00:00:00Z",
      }),
      obs({
        observationStatus: "unavailable",
        observedAt: "2026-07-03T02:00:00Z",
      }),
      obs({
        observationStatus: "unavailable",
        observedAt: "2026-07-12T00:00:00Z",
      }),
    ]);
    // Suspected is reachable, but confirmed requires a high-confidence not_found.
    expect(results[2]!.state.status).not.toBe("confirmed_inactive");
  });
});
