import { describe, expect, it } from "vitest";
import {
  DEMO_SOURCE_KEY,
  FIXTURE_FILES,
  readDemoSourceRules,
  readFixture,
} from "./index";

describe("test fixtures", () => {
  it("exposes the demo source key", () => {
    expect(DEMO_SOURCE_KEY).toBe("demo_fixture");
  });

  it("baseline has a header plus six demo listings", () => {
    const lines = readFixture("baseline")
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
    expect(lines).toHaveLength(7); // header + 6 rows
    expect(lines[0]).toContain("source_key");
    expect(lines[1]).toContain("demo_fixture");
  });

  it("every fixture file name is resolvable and readable", () => {
    for (const name of Object.keys(
      FIXTURE_FILES,
    ) as (keyof typeof FIXTURE_FILES)[]) {
      expect(readFixture(name).length).toBeGreaterThan(0);
    }
  });

  it("demo source rules parse to the expected shape", () => {
    const rules = readDemoSourceRules() as { source_key: string };
    expect(rules.source_key).toBe("demo_fixture");
  });
});
