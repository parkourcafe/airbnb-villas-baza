import { describe, expect, it } from "vitest";
import { roundCoordinate, roundMapPoint } from "./index";

describe("roundCoordinate", () => {
  it("rounds to the default precision (~110m)", () => {
    expect(roundCoordinate(-8.647812)).toBe(-8.648);
    expect(roundCoordinate(115.138499)).toBe(115.138);
  });

  it("honors an explicit decimal count", () => {
    expect(roundCoordinate(-8.647812, 4)).toBe(-8.6478);
    expect(roundCoordinate(-8.647812, 0)).toBe(-9);
  });

  it("never increases precision", () => {
    const rounded = roundCoordinate(-8.6, 3);
    expect(rounded).toBe(-8.6);
  });

  it("passes through non-finite values unchanged", () => {
    expect(Number.isNaN(roundCoordinate(Number.NaN))).toBe(true);
  });

  it("rounds a map point pair", () => {
    expect(
      roundMapPoint({ latitude: -8.647812, longitude: 115.138499 }),
    ).toEqual({ latitude: -8.648, longitude: 115.138 });
  });
});
