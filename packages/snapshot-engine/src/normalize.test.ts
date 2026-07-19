import { describe, expect, it } from "vitest";
import { contentHash, normalizeText, normalizedHash } from "./index";

describe("snapshot normalization", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Villa   Aruna\n\t")).toBe("Villa Aruna");
  });

  it("produces identical hashes for whitespace-only differences", () => {
    expect(normalizedHash("Villa   Aruna")).toBe(normalizedHash("Villa Aruna"));
  });

  it("produces a stable, reproducible sha256 hex", () => {
    expect(contentHash("Villa Aruna")).toBe(
      contentHash(normalizeText("Villa Aruna")),
    );
    expect(contentHash("Villa Aruna")).toMatch(/^[0-9a-f]{64}$/);
  });
});
