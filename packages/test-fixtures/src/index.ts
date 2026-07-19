import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * `@bai/test-fixtures` - controlled demo datasets.
 *
 * Every row uses the `demo_fixture` source and is EXPLICITLY demo data. It must
 * never be presented as real production data anywhere in the product.
 */
export const DEMO_SOURCE_KEY = "demo_fixture" as const;

export const FIXTURE_FILES = {
  baseline: "baseline.csv",
  followup1: "followup_1.csv",
  followup2: "followup_2.csv",
  followup3: "followup_3.csv",
  reactivated: "reactivated.csv",
  invalidRows: "invalid_rows.csv",
  demoSourceRules: "source_rules.demo_fixture.json",
} as const;

export type FixtureName = keyof typeof FIXTURE_FILES;

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);

/** Absolute path to a fixture file on disk. */
export function fixturePath(name: FixtureName): string {
  return join(fixturesDir, FIXTURE_FILES[name]);
}

/** Read a fixture file as UTF-8 text. */
export function readFixture(name: FixtureName): string {
  return readFileSync(fixturePath(name), "utf8");
}

/** Parse the demo source rules JSON (coverage/lifecycle/materiality config). */
export function readDemoSourceRules(): unknown {
  return JSON.parse(readFixture("demoSourceRules"));
}
