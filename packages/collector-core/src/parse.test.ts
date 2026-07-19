import { describe, expect, it } from "vitest";
import {
  accessDeniedHtml,
  blockedHtml,
  captchaHtml,
  listingDetailHtml,
  loginChallengeHtml,
  malformedSearchPageHtml,
  noResultsPageHtml,
  searchPageHtml,
} from "./fixtures";
import { classifyPageState, parseDetailHtml, parseSearchHtml } from "./parse";

const SAMPLE_CARDS = [
  {
    listingId: "12345",
    title: "Villa Aruna",
    area: "Canggu",
    rating: 4.92,
    reviewCount: 184,
    price: "3500000",
    currency: "IDR",
    guests: 6,
    bedrooms: 3,
    lat: -8.6478,
    lng: 115.1385,
    image: "https://img.example/1.jpg",
  },
  { listingId: "67890", title: "Villa Sora", area: "Uluwatu", rating: 4.88 },
];

describe("classifyPageState", () => {
  it("reads the explicit meta state", () => {
    expect(classifyPageState(captchaHtml())).toBe("captcha");
    expect(classifyPageState(loginChallengeHtml())).toBe("login_challenge");
    expect(classifyPageState(accessDeniedHtml())).toBe("access_denied");
    expect(classifyPageState(blockedHtml())).toBe("blocked");
    expect(classifyPageState(noResultsPageHtml())).toBe("no_results");
    expect(classifyPageState(searchPageHtml(SAMPLE_CARDS))).toBe("ok");
  });

  it("falls back to text heuristics without a meta tag", () => {
    expect(classifyPageState("<body>We detected unusual traffic</body>")).toBe(
      "captcha",
    );
    expect(classifyPageState("<body>Log in or sign up</body>")).toBe(
      "login_challenge",
    );
    expect(classifyPageState("<body>Access Denied</body>")).toBe(
      "access_denied",
    );
  });
});

describe("parseSearchHtml", () => {
  it("extracts every field from a well-formed card", () => {
    const { state, cards, malformedCount } = parseSearchHtml(
      searchPageHtml(SAMPLE_CARDS),
    );
    expect(state).toBe("ok");
    expect(malformedCount).toBe(0);
    expect(cards).toHaveLength(2);
    const first = cards[0]!;
    expect(first.sourceListingId).toBe("12345");
    expect(first.canonicalUrl).toBe("/rooms/12345");
    expect(first.title).toBe("Villa Aruna");
    expect(first.area).toBe("Canggu");
    expect(first.rating).toBe(4.92);
    expect(first.reviewCount).toBe(184);
    expect(first.displayedPrice).toBe("3500000");
    expect(first.currency).toBe("IDR");
    expect(first.guestCapacity).toBe(6);
    expect(first.bedrooms).toBe(3);
    expect(first.latitude).toBeCloseTo(-8.6478, 4);
    expect(first.longitude).toBeCloseTo(115.1385, 4);
    expect(first.imageUrl).toBe("https://img.example/1.jpg");
  });

  it("parses the listing id from the href when no data attribute is present", () => {
    const html = searchPageHtml([
      { listingId: "555", url: "/rooms/plus/555", title: "By href" },
    ]).replace('data-listing-id="555"', "");
    const { cards } = parseSearchHtml(html);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.sourceListingId).toBe("555");
  });

  it("skips malformed cards but keeps the valid ones", () => {
    const { cards, malformedCount } = parseSearchHtml(
      malformedSearchPageHtml([SAMPLE_CARDS[0]!]),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.sourceListingId).toBe("12345");
    expect(malformedCount).toBe(1);
  });

  it("returns no_results for an empty search page", () => {
    const { state, cards } = parseSearchHtml(noResultsPageHtml());
    expect(state).toBe("no_results");
    expect(cards).toHaveLength(0);
  });

  it("does not extract cards from a blocking page", () => {
    const { state, cards } = parseSearchHtml(captchaHtml());
    expect(state).toBe("captcha");
    expect(cards).toHaveLength(0);
  });
});

describe("parseDetailHtml", () => {
  it("extracts detail fields", () => {
    const { state, detail } = parseDetailHtml(
      listingDetailHtml({
        listingId: "12345",
        propertyType: "Villa",
        description: "A calm villa near the beach.",
        bedrooms: 3,
        beds: 4,
        bathrooms: 3,
        maxGuests: 6,
        amenities: ["Pool", "Wifi", "Kitchen"],
        hostName: "Aruna",
        hostId: "host-001",
        superhost: true,
        photos: ["https://img/1.jpg", "https://img/2.jpg"],
      }),
    );
    expect(state).toBe("ok");
    expect(detail).not.toBeNull();
    expect(detail?.observedStatus).toBe("collected");
    expect(detail?.propertyType).toBe("Villa");
    expect(detail?.description).toContain("calm villa");
    expect(detail?.beds).toBe(4);
    expect(detail?.maxGuests).toBe(6);
    expect(detail?.amenities).toEqual(["Pool", "Wifi", "Kitchen"]);
    expect(detail?.hostName).toBe("Aruna");
    expect(detail?.sourceHostId).toBe("host-001");
    expect(detail?.isSuperhost).toBe(true);
    expect(detail?.photoUrls).toHaveLength(2);
  });

  it("reports a blocking detail page as blocked", () => {
    const { state, detail } = parseDetailHtml(loginChallengeHtml());
    expect(state).toBe("login_challenge");
    // No id is resolvable, so no detail row is produced, but the state blocks.
    expect(detail).toBeNull();
  });
});
