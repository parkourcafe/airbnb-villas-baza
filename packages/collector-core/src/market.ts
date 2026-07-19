/**
 * Configurable market definition. A market is a named set of areas, each with a
 * geographic bounding box the search planner can subdivide into cells. Bounding
 * boxes are deliberately approximate; they exist to bound the search, not to
 * assert precise administrative borders.
 */
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MarketArea {
  key: string;
  name: string;
  bbox: BoundingBox;
  /** Default map zoom the collector requests for this area's search. */
  defaultZoom: number;
}

export interface MarketDefinition {
  key: string;
  name: string;
  defaultCurrency: string;
  areas: MarketArea[];
}

/** Build a bounding box centred on a point, sized by degree half-spans. */
function box(
  lat: number,
  lng: number,
  latSpan: number,
  lngSpan: number,
): BoundingBox {
  return {
    north: round6(lat + latSpan),
    south: round6(lat - latSpan),
    east: round6(lng + lngSpan),
    west: round6(lng - lngSpan),
  };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Bali market — the initial 17 configurable areas. Centres/spans are starter
 * values an operator can tune; the planner subdivides any box that is too large
 * for a single search.
 */
export const BALI_MARKET: MarketDefinition = {
  key: "bali",
  name: "Bali",
  defaultCurrency: "IDR",
  areas: [
    {
      key: "canggu",
      name: "Canggu",
      bbox: box(-8.648, 115.138, 0.02, 0.02),
      defaultZoom: 14,
    },
    {
      key: "berawa",
      name: "Berawa",
      bbox: box(-8.66, 115.142, 0.015, 0.015),
      defaultZoom: 15,
    },
    {
      key: "pererenan",
      name: "Pererenan",
      bbox: box(-8.647, 115.121, 0.015, 0.015),
      defaultZoom: 15,
    },
    {
      key: "seminyak",
      name: "Seminyak",
      bbox: box(-8.69, 115.162, 0.02, 0.02),
      defaultZoom: 14,
    },
    {
      key: "umalas",
      name: "Umalas",
      bbox: box(-8.671, 115.153, 0.015, 0.015),
      defaultZoom: 15,
    },
    {
      key: "ubud",
      name: "Ubud",
      bbox: box(-8.507, 115.263, 0.03, 0.03),
      defaultZoom: 14,
    },
    {
      key: "sanur",
      name: "Sanur",
      bbox: box(-8.688, 115.262, 0.025, 0.02),
      defaultZoom: 14,
    },
    {
      key: "jimbaran",
      name: "Jimbaran",
      bbox: box(-8.79, 115.163, 0.025, 0.025),
      defaultZoom: 14,
    },
    {
      key: "nusa_dua",
      name: "Nusa Dua",
      bbox: box(-8.803, 115.228, 0.025, 0.025),
      defaultZoom: 14,
    },
    {
      key: "uluwatu",
      name: "Uluwatu",
      bbox: box(-8.829, 115.087, 0.03, 0.03),
      defaultZoom: 14,
    },
    {
      key: "bingin",
      name: "Bingin",
      bbox: box(-8.807, 115.113, 0.012, 0.012),
      defaultZoom: 15,
    },
    {
      key: "balangan",
      name: "Balangan",
      bbox: box(-8.79, 115.122, 0.012, 0.012),
      defaultZoom: 15,
    },
    {
      key: "amed",
      name: "Amed",
      bbox: box(-8.339, 115.66, 0.03, 0.04),
      defaultZoom: 14,
    },
    {
      key: "candidasa",
      name: "Candidasa",
      bbox: box(-8.511, 115.568, 0.025, 0.03),
      defaultZoom: 14,
    },
    {
      key: "sidemen",
      name: "Sidemen",
      bbox: box(-8.449, 115.443, 0.03, 0.03),
      defaultZoom: 14,
    },
    {
      key: "lovina",
      name: "Lovina",
      bbox: box(-8.158, 115.026, 0.03, 0.05),
      defaultZoom: 14,
    },
    {
      key: "tabanan",
      name: "Tabanan",
      bbox: box(-8.537, 115.125, 0.04, 0.04),
      defaultZoom: 13,
    },
  ],
};

export const MARKETS: Record<string, MarketDefinition> = {
  [BALI_MARKET.key]: BALI_MARKET,
};

export function getMarket(key: string): MarketDefinition | undefined {
  return MARKETS[key];
}

export function getMarketArea(
  market: MarketDefinition,
  areaKey: string,
): MarketArea | undefined {
  return market.areas.find((a) => a.key === areaKey);
}
