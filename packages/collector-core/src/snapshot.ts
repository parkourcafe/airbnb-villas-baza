import type { SnapshotQualityStatus } from "@bai/domain";
import type { RawCard } from "./types";

export interface SnapshotCoverageInput {
  plannedCells: number;
  completedCells: number;
  failedCells: number;
  errors: number;
}

/** Fraction (0..1) of planned search cells that completed. */
export function searchCellCoverage(
  plannedCells: number,
  completedCells: number,
): number {
  if (plannedCells <= 0) return 0;
  return clamp01(completedCells / plannedCells);
}

/** Whole-percent completion (0..100) of planned search cells. */
export function completionPercentage(
  plannedCells: number,
  completedCells: number,
): number {
  return Math.round(searchCellCoverage(plannedCells, completedCells) * 100);
}

/**
 * Derive the snapshot quality status from coverage and error signals.
 *
 * - `failed`   — nothing usable was collected.
 * - `complete` — every planned cell completed with no failures or errors.
 * - `degraded` — coverage is poor or failures dominate; must not be compared
 *                automatically without explicit user confirmation.
 * - `partial`  — some coverage with minor gaps.
 */
export function deriveQualityStatus(
  input: SnapshotCoverageInput,
): SnapshotQualityStatus {
  const { plannedCells, completedCells, failedCells, errors } = input;
  if (plannedCells <= 0 || completedCells <= 0) return "failed";

  const coverage = searchCellCoverage(plannedCells, completedCells);
  if (completedCells >= plannedCells && failedCells === 0 && errors === 0) {
    return "complete";
  }
  if (coverage < 0.5 || failedCells >= completedCells) {
    return "degraded";
  }
  return "partial";
}

/**
 * A stable per-listing fingerprint used to build the snapshot checksum. Only
 * identity + the material observed fields participate, so re-running the same
 * collection over an unchanged market yields the same checksum.
 */
export function snapshotListingFingerprint(card: RawCard): string {
  return [
    card.sourceListingId,
    fmt(card.rating),
    fmt(card.reviewCount),
    card.displayedPrice ?? "",
    card.currency ?? "",
  ].join("|");
}

/**
 * Compute a stable snapshot checksum over the listing fingerprints. Order does
 * not matter (fingerprints are sorted). Dependency-free FNV-1a (64-bit) keeps
 * the package importable from the browser and the worker alike.
 */
export function computeSnapshotChecksum(
  fingerprints: readonly string[],
): string {
  const canonical = [...fingerprints].sort().join("\n");
  return fnv1a64Hex(canonical);
}

/** Convenience: checksum directly from a set of deduplicated cards. */
export function computeSnapshotChecksumFromCards(
  cards: readonly RawCard[],
): string {
  return computeSnapshotChecksum(cards.map(snapshotListingFingerprint));
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

function fnv1a64Hex(input: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i) & 0xff);
    hash = (hash * FNV_PRIME) & MASK64;
    // Mix in the high byte of multi-byte code points so they affect the hash.
    const high = input.charCodeAt(i) >> 8;
    if (high) {
      hash ^= BigInt(high);
      hash = (hash * FNV_PRIME) & MASK64;
    }
  }
  return hash.toString(16).padStart(16, "0");
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function fmt(value: number | null): string {
  return value == null ? "" : String(value);
}
