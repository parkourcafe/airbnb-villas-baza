import { describe, expect, it } from "vitest";
import {
  canManageMembers,
  canManageOrganization,
  canMutateData,
  isReadOnly,
  sanitizeInternalPath,
} from "./index";

describe("role capabilities", () => {
  it("lets owners and admins manage the organization", () => {
    expect(canManageOrganization("owner")).toBe(true);
    expect(canManageOrganization("admin")).toBe(true);
    expect(canManageOrganization("analyst")).toBe(false);
    expect(canManageOrganization("viewer")).toBe(false);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("analyst")).toBe(false);
  });

  it("treats viewers as read-only (AUTH-04)", () => {
    expect(canMutateData("viewer")).toBe(false);
    expect(isReadOnly("viewer")).toBe(true);
    expect(canMutateData("analyst")).toBe(true);
    expect(canMutateData("owner")).toBe(true);
  });
});

describe("sanitizeInternalPath (open redirect protection)", () => {
  it("accepts internal paths", () => {
    expect(sanitizeInternalPath("/app/properties")).toBe("/app/properties");
    expect(sanitizeInternalPath("/app/events?status=active")).toBe(
      "/app/events?status=active",
    );
  });

  it("rejects external and protocol-relative targets", () => {
    expect(sanitizeInternalPath("https://evil.com")).toBe("/app/overview");
    expect(sanitizeInternalPath("//evil.com")).toBe("/app/overview");
    expect(sanitizeInternalPath("/\\evil.com")).toBe("/app/overview");
    expect(sanitizeInternalPath("javascript:alert(1)")).toBe("/app/overview");
    expect(sanitizeInternalPath("/a\\b")).toBe("/app/overview");
    expect(sanitizeInternalPath(null)).toBe("/app/overview");
    expect(sanitizeInternalPath("")).toBe("/app/overview");
  });

  it("honors a custom fallback", () => {
    expect(sanitizeInternalPath(undefined, "/login")).toBe("/login");
  });
});
