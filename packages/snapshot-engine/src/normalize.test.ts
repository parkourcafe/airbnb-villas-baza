import { describe, expect, it } from "vitest";
import {
  contentHash,
  normalizeSet,
  normalizeText,
  normalizeUrl,
  normalizedHash,
  parseBoolean,
  parseNumber,
  setDelta,
  setHash,
} from "./index";

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

describe("url normalization", () => {
  it("strips tracking params, fragments and sorts the query", () => {
    expect(
      normalizeUrl("https://Example.com/villa?utm_source=ig&b=2&a=1#photos"),
    ).toBe("https://example.com/villa?a=1&b=2");
  });

  it("treats tracking-only differences as equal", () => {
    expect(normalizeUrl("https://host.co/x?fbclid=abc")).toBe(
      normalizeUrl("https://host.co/x?gclid=zzz"),
    );
  });

  it("removes default ports and trailing slashes", () => {
    expect(normalizeUrl("https://host.co:443/path/")).toBe(
      "https://host.co/path",
    );
  });

  it("rejects non-http(s) and malformed URLs", () => {
    expect(normalizeUrl("ftp://host.co/x")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("scalar parsing", () => {
  it("parses booleans and rejects noise", () => {
    expect(parseBoolean("Yes")).toBe(true);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("maybe")).toBeNull();
  });

  it("parses numbers with thousands separators", () => {
    expect(parseNumber("3,500,000")).toBe(3500000);
    expect(parseNumber("4.5")).toBe(4.5);
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("set normalization", () => {
  it("sorts, de-duplicates, lower-cases and drops blanks", () => {
    expect(normalizeSet([" Pool ", "wifi", "POOL", ""])).toEqual([
      "pool",
      "wifi",
    ]);
  });

  it("hashes order- and case-independently", () => {
    expect(setHash(["Wifi", "Pool"])).toBe(setHash(["pool", "wifi"]));
  });

  it("reports added and removed members", () => {
    expect(setDelta(["pool", "wifi"], ["wifi", "kitchen"])).toEqual({
      added: ["kitchen"],
      removed: ["pool"],
    });
  });
});
