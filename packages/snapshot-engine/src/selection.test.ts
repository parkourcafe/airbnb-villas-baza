import { describe, expect, it } from "vitest";
import {
  type ComparableCandidate,
  selectComparableSnapshot,
} from "./index";

const present = (fields: string[]): Record<string, boolean> =>
  Object.fromEntries(fields.map((f) => [f, true]));

const current = { observedAt: "2026-07-20T00:00:00Z", parserVersion: "csv:v1" };

const candidates: ComparableCandidate[] = [
  {
    id: "s1",
    observedAt: "2026-07-17T00:00:00Z",
    parserVersion: "csv:v1",
    fieldPresence: present(["rating", "price"]),
  },
  {
    id: "s2",
    observedAt: "2026-07-19T00:00:00Z",
    parserVersion: "csv:v1",
    fieldPresence: present(["rating"]), // price NOT collected here
  },
];

describe("selectComparableSnapshot", () => {
  it("picks the latest earlier snapshot valid for the field", () => {
    expect(selectComparableSnapshot(current, candidates, "rating")?.id).toBe("s2");
  });

  it("skips snapshots that did not collect the field", () => {
    // s2 lacks price, so price falls back to the older s1.
    expect(selectComparableSnapshot(current, candidates, "price")?.id).toBe("s1");
  });

  it("never selects a snapshot at or after the current time", () => {
    const later = { observedAt: "2026-07-18T00:00:00Z", parserVersion: "csv:v1" };
    expect(selectComparableSnapshot(later, candidates, "rating")?.id).toBe("s1");
  });

  it("excludes degraded-run snapshots", () => {
    const degraded: ComparableCandidate[] = [
      { ...candidates[1]!, runDegraded: true },
    ];
    expect(selectComparableSnapshot(current, degraded, "rating")).toBeNull();
  });

  it("excludes parser-incompatible snapshots by default", () => {
    const other: ComparableCandidate[] = [
      { ...candidates[0]!, parserVersion: "csv:v2" },
    ];
    expect(selectComparableSnapshot(current, other, "rating")).toBeNull();
    expect(
      selectComparableSnapshot(current, other, "rating", {
        isParserCompatible: () => true,
      })?.id,
    ).toBe("s1");
  });

  it("returns null when nothing qualifies", () => {
    expect(selectComparableSnapshot(current, [], "rating")).toBeNull();
  });
});
