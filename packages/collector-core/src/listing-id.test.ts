import { describe, expect, it } from "vitest";
import { normalizeListingId, parseListingIdFromUrl } from "./listing-id";

describe("parseListingIdFromUrl", () => {
  it("parses a plain rooms url", () => {
    expect(parseListingIdFromUrl("https://www.airbnb.com/rooms/12345")).toBe(
      "12345",
    );
  });

  it("parses a rooms url with a segment prefix", () => {
    expect(
      parseListingIdFromUrl("https://www.airbnb.com/rooms/plus/98765"),
    ).toBe("98765");
  });

  it("ignores query strings and fragments", () => {
    expect(
      parseListingIdFromUrl(
        "https://www.airbnb.co.id/rooms/555?source_impression_id=abc#photos",
      ),
    ).toBe("555");
  });

  it("parses a relative rooms path", () => {
    expect(parseListingIdFromUrl("/rooms/42")).toBe("42");
  });

  it("falls back to an explicit id query param", () => {
    expect(parseListingIdFromUrl("https://x.example/l?listing_id=777")).toBe(
      "777",
    );
  });

  it("returns null when there is no id", () => {
    expect(parseListingIdFromUrl("https://www.airbnb.com/s/Bali")).toBeNull();
    expect(parseListingIdFromUrl("")).toBeNull();
    expect(parseListingIdFromUrl(null)).toBeNull();
  });
});

describe("normalizeListingId", () => {
  it("trims and rejects blanks", () => {
    expect(normalizeListingId("  12 ")).toBe("12");
    expect(normalizeListingId("   ")).toBeNull();
    expect(normalizeListingId(null)).toBeNull();
  });
});
