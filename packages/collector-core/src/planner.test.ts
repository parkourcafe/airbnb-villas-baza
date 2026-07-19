import { describe, expect, it } from "vitest";
import { BALI_MARKET, getMarketArea } from "./market";
import {
  planAreaCells,
  planMarketCells,
  subdivideBoundingBox,
} from "./planner";

describe("subdivideBoundingBox", () => {
  it("returns a single cell for a small box", () => {
    const cells = subdivideBoundingBox(
      { north: 1.01, south: 1.0, east: 2.01, west: 2.0 },
      14,
      "tiny",
      { maxCellSpanDegrees: 0.05 },
    );
    expect(cells).toHaveLength(1);
    expect(cells[0]?.parentArea).toBe("tiny");
    expect(cells[0]?.zoom).toBe(14);
  });

  it("subdivides a large box into a covering grid", () => {
    const cells = subdivideBoundingBox(
      { north: 1.0, south: 0.0, east: 1.0, west: 0.0 },
      12,
      "big",
      { maxCellSpanDegrees: 0.5 },
    );
    // 1.0 / 0.5 = 2 divisions per axis => 4 cells.
    expect(cells).toHaveLength(4);
    // Cells cover the full box without gaps at the extremes.
    const souths = cells.map((c) => c.south);
    const norths = cells.map((c) => c.north);
    expect(Math.min(...souths)).toBeCloseTo(0.0, 6);
    expect(Math.max(...norths)).toBeCloseTo(1.0, 6);
  });

  it("respects the max divisions cap", () => {
    const cells = subdivideBoundingBox(
      { north: 10, south: 0, east: 10, west: 0 },
      12,
      "huge",
      { maxCellSpanDegrees: 0.01, maxDivisionsPerAxis: 3 },
    );
    expect(cells).toHaveLength(9);
  });
});

describe("planMarketCells", () => {
  it("plans cells for selected areas only", () => {
    const cells = planMarketCells(BALI_MARKET, ["canggu", "ubud"]);
    const areas = new Set(cells.map((c) => c.parentArea));
    expect(areas).toEqual(new Set(["canggu", "ubud"]));
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores unknown area keys", () => {
    const cells = planMarketCells(BALI_MARKET, ["canggu", "atlantis"]);
    expect(cells.every((c) => c.parentArea === "canggu")).toBe(true);
  });

  it("plans at least one cell for every Bali area", () => {
    for (const area of BALI_MARKET.areas) {
      expect(planAreaCells(area).length).toBeGreaterThanOrEqual(1);
    }
    expect(getMarketArea(BALI_MARKET, "seminyak")?.name).toBe("Seminyak");
  });
});
