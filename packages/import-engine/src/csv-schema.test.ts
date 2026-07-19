import { describe, expect, it } from "vitest";
import {
  assertRequiredHeaders,
  CSV_COLUMNS,
  REQUIRED_CSV_HEADERS,
} from "./index";

describe("CSV header contract", () => {
  it("keeps required headers a subset of the full column list", () => {
    for (const header of REQUIRED_CSV_HEADERS) {
      expect(CSV_COLUMNS).toContain(header);
    }
  });

  it("accepts a header row that includes all required columns", () => {
    expect(() => assertRequiredHeaders([...CSV_COLUMNS])).not.toThrow();
  });

  it("rejects a header row missing a required column", () => {
    expect(() =>
      assertRequiredHeaders(["source_key", "external_id", "observed_at"]),
    ).toThrow(/observation_status/);
  });
});
