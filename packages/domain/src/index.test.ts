import { describe, expect, it } from "vitest";
import {
  isComparablePrice,
  moneySchema,
  OBSERVATION_STATUS,
  SOURCE_FAILURE_STATUSES,
  ValidationError,
  isDomainError,
} from "./index";

describe("@bai/domain enums", () => {
  it("exposes the full observation-status vocabulary", () => {
    expect(OBSERVATION_STATUS).toContain("search_not_observed");
    expect(OBSERVATION_STATUS).toContain("source_error");
  });

  it("classifies source failures separately from real signals", () => {
    expect(SOURCE_FAILURE_STATUSES).toContain("source_error");
    expect(SOURCE_FAILURE_STATUSES).not.toContain("not_found");
  });
});

describe("@bai/domain money", () => {
  it("only compares prices with matching currency and unit", () => {
    const a = { amount: "100", currency: "IDR", unit: "night" as const };
    expect(
      isComparablePrice(a, { amount: "200", currency: "IDR", unit: "night" }),
    ).toBe(true);
    expect(
      isComparablePrice(a, { amount: "200", currency: "USD", unit: "night" }),
    ).toBe(false);
    expect(
      isComparablePrice(a, { amount: "200", currency: "IDR", unit: "stay" }),
    ).toBe(false);
  });

  it("validates money input via zod", () => {
    expect(
      moneySchema.parse({ amount: "3500000", currency: "idr", unit: "night" }),
    ).toEqual({ amount: "3500000", currency: "IDR", unit: "night" });
    expect(() =>
      moneySchema.parse({ amount: "abc", currency: "IDR", unit: "night" }),
    ).toThrow();
  });
});

describe("@bai/domain errors", () => {
  it("marks domain errors with a stable code", () => {
    const err = new ValidationError("bad input");
    expect(isDomainError(err)).toBe(true);
    expect(err.code).toBe("validation_error");
  });
});
