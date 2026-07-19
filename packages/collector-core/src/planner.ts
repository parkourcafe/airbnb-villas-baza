import type { BoundingBox, MarketArea, MarketDefinition } from "./market";
import { getMarketArea } from "./market";

/**
 * A planned search cell: a bounding box small enough to be searched in one pass,
 * tagged with its parent area and the map zoom to request. The worker persists
 * one row per cell and reports coverage against the planned set.
 */
export interface SearchCell {
  parentArea: string;
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

export interface PlannerOptions {
  /**
   * A cell is subdivided while either dimension exceeds this many degrees. Bali
   * areas are small, so the default keeps most areas to 1–4 cells.
   */
  maxCellSpanDegrees?: number;
  /** Hard cap on grid divisions per axis, so a huge box can't explode the plan. */
  maxDivisionsPerAxis?: number;
}

const DEFAULT_MAX_SPAN = 0.03;
const DEFAULT_MAX_DIVISIONS = 8;

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Subdivide a bounding box into a near-square grid of cells, each no larger than
 * `maxCellSpanDegrees` per axis (bounded by `maxDivisionsPerAxis`). A box already
 * within the threshold yields a single cell.
 */
export function subdivideBoundingBox(
  bbox: BoundingBox,
  zoom: number,
  parentArea: string,
  options: PlannerOptions = {},
): SearchCell[] {
  const maxSpan = options.maxCellSpanDegrees ?? DEFAULT_MAX_SPAN;
  const maxDivisions = options.maxDivisionsPerAxis ?? DEFAULT_MAX_DIVISIONS;

  const latSpan = Math.abs(bbox.north - bbox.south);
  const lngSpan = Math.abs(bbox.east - bbox.west);

  const latDivisions = clampDivisions(
    Math.ceil(latSpan / maxSpan),
    maxDivisions,
  );
  const lngDivisions = clampDivisions(
    Math.ceil(lngSpan / maxSpan),
    maxDivisions,
  );

  const south = Math.min(bbox.north, bbox.south);
  const west = Math.min(bbox.east, bbox.west);
  const latStep = latSpan / latDivisions;
  const lngStep = lngSpan / lngDivisions;

  const cells: SearchCell[] = [];
  for (let row = 0; row < latDivisions; row += 1) {
    for (let col = 0; col < lngDivisions; col += 1) {
      const cellSouth = south + row * latStep;
      const cellWest = west + col * lngStep;
      cells.push({
        parentArea,
        south: round6(cellSouth),
        north: round6(cellSouth + latStep),
        west: round6(cellWest),
        east: round6(cellWest + lngStep),
        zoom,
      });
    }
  }
  return cells;
}

function clampDivisions(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, max);
}

/** Plan the cells for a single area. */
export function planAreaCells(
  area: MarketArea,
  options: PlannerOptions = {},
): SearchCell[] {
  return subdivideBoundingBox(area.bbox, area.defaultZoom, area.key, options);
}

/**
 * Plan the cells for the selected areas of a market. Unknown area keys are
 * ignored (the caller validates selection). Cells are returned area by area in
 * the order the areas were selected.
 */
export function planMarketCells(
  market: MarketDefinition,
  selectedAreaKeys: readonly string[],
  options: PlannerOptions = {},
): SearchCell[] {
  const cells: SearchCell[] = [];
  for (const key of selectedAreaKeys) {
    const area = getMarketArea(market, key);
    if (!area) continue;
    cells.push(...planAreaCells(area, options));
  }
  return cells;
}
