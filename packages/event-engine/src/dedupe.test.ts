import { describe, expect, it } from "vitest";
import { eventDedupeKey, EVENT_ENGINE_RULE_VERSION } from "./index";

describe("event deduplication key", () => {
  const base = {
    sourceListingId: "listing-1",
    eventType: "first_miss" as const,
    runId: "run-1",
  };

  it("is stable for identical inputs (idempotent reprocessing)", () => {
    expect(eventDedupeKey(base)).toBe(eventDedupeKey(base));
  });

  it("differs when the event type differs", () => {
    expect(eventDedupeKey(base)).not.toBe(
      eventDedupeKey({ ...base, eventType: "reactivated" }),
    );
  });

  it("differs when the run differs", () => {
    expect(eventDedupeKey(base)).not.toBe(
      eventDedupeKey({ ...base, runId: "run-2" }),
    );
  });

  it("defaults to the current rule version", () => {
    expect(eventDedupeKey(base)).toBe(
      eventDedupeKey({ ...base, ruleVersion: EVENT_ENGINE_RULE_VERSION }),
    );
  });
});
