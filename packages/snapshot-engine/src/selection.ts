/**
 * Comparable previous-snapshot selection (04 §11). The `previous_snapshot` for a
 * field is NOT simply the immediately preceding row: it is the latest earlier
 * snapshot that is also valid for that field, parser-compatible, and not from a
 * degraded run.
 */

export interface ComparableCandidate {
  id: string;
  observedAt: string;
  parserVersion: string;
  /** field_presence map for the candidate snapshot. */
  fieldPresence: Record<string, boolean>;
  /** Whether the candidate's collection run was degraded (04 §7). */
  runDegraded?: boolean;
}

export interface SelectionTarget {
  observedAt: string;
  parserVersion: string;
}

export interface SelectionOptions {
  /**
   * Decide whether two parser versions may be compared. Defaults to an exact
   * version match; register known-compatible pairs by supplying a predicate.
   */
  isParserCompatible?: (candidate: string, current: string) => boolean;
}

/**
 * Select the latest earlier snapshot comparable to `current` for `field`.
 * Candidates must be for the same source listing (the caller supplies only that
 * listing's snapshots). Returns `null` when nothing qualifies. Deterministic:
 * ties on `observedAt` are broken by `id` so selection never depends on input
 * ordering.
 */
export function selectComparableSnapshot(
  current: SelectionTarget,
  candidates: readonly ComparableCandidate[],
  field: string,
  options: SelectionOptions = {},
): ComparableCandidate | null {
  const compatible =
    options.isParserCompatible ??
    ((candidate: string, currentVersion: string) =>
      candidate === currentVersion);
  const currentTime = Date.parse(current.observedAt);

  const eligible = candidates.filter((candidate) => {
    const candidateTime = Date.parse(candidate.observedAt);
    if (!(candidateTime < currentTime)) return false; // strictly earlier
    if (candidate.fieldPresence[field] !== true) return false; // valid for field
    if (candidate.runDegraded === true) return false; // not from a degraded run
    if (!compatible(candidate.parserVersion, current.parserVersion))
      return false;
    return true;
  });

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const at = Date.parse(a.observedAt);
    const bt = Date.parse(b.observedAt);
    if (at !== bt) return bt - at; // latest first
    return b.id.localeCompare(a.id); // deterministic tie-break
  });

  return eligible[0] ?? null;
}
