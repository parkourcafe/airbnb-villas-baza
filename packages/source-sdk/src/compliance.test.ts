import { describe, expect, it } from "vitest";
import { ComplianceError } from "@bai/domain";
import {
  assertSourceExecutionAllowed,
  isSourceExecutionAllowed,
  type SourceAdapterDefinition,
} from "./index";

const approved: SourceAdapterDefinition = {
  key: "demo_fixture",
  displayName: "Demo Fixture",
  accessMode: "demo_fixture",
  complianceStatus: "approved",
  automationAllowed: true,
  capabilities: ["listing_identity", "listing_status", "price"],
  parserVersion: "1.0.0",
};

const disabledAirbnb: SourceAdapterDefinition = {
  ...approved,
  key: "airbnb",
  displayName: "Airbnb",
  accessMode: "browser_automation",
  complianceStatus: "disabled",
  automationAllowed: false,
};

describe("source compliance gate", () => {
  it("allows an approved, automatable source", () => {
    expect(() =>
      assertSourceExecutionAllowed(approved, { now: new Date("2026-07-19") }),
    ).not.toThrow();
  });

  it("blocks a disabled source even when a job is inserted", () => {
    expect(() => assertSourceExecutionAllowed(disabledAirbnb)).toThrow(
      ComplianceError,
    );
  });

  it("blocks a pending source", () => {
    expect(
      isSourceExecutionAllowed({
        ...approved,
        complianceStatus: "pending_review",
      }),
    ).toBe(false);
  });

  it("blocks automated execution when automation is not allowed", () => {
    expect(
      isSourceExecutionAllowed(
        { ...approved, automationAllowed: false },
        { automated: true },
      ),
    ).toBe(false);
  });

  it("blocks an expired review", () => {
    expect(
      isSourceExecutionAllowed(
        { ...approved, reviewExpiresAt: "2026-01-01T00:00:00Z" },
        { now: new Date("2026-07-19T00:00:00Z") },
      ),
    ).toBe(false);
  });

  it("blocks an undeclared capability request", () => {
    expect(
      isSourceExecutionAllowed(approved, {
        requestedCapabilities: ["host_identity"],
      }),
    ).toBe(false);
  });
});
