/**
 * Pure helpers for ranking merge candidates (manual entity resolution, 09).
 * A likely duplicate scores high on name similarity and geographic proximity.
 * No I/O — fully deterministic and unit-testable.
 */

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two lat/lng points. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeName(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/** Name similarity in [0,1]: 1 is identical (after normalization). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === "" && nb === "") return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface MergeCandidateInput {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface RankedMergeCandidate extends MergeCandidateInput {
  /** Combined similarity score in [0,1]; higher is a more likely duplicate. */
  score: number;
  distanceMeters: number | null;
}

/** Distance at/above which proximity contributes nothing (≈5 km). */
const MAX_PROXIMITY_M = 5_000;

/**
 * Rank candidate properties by likelihood of being the same property as
 * `target`. Score blends name similarity (70%) and proximity (30%); proximity
 * is skipped when either point lacks coordinates. Sorted best-first,
 * deterministic (id tie-break).
 */
export function rankMergeCandidates(
  target: MergeCandidateInput,
  candidates: readonly MergeCandidateInput[],
): RankedMergeCandidate[] {
  return candidates
    .map((candidate) => {
      const name = nameSimilarity(target.name, candidate.name);
      let distanceMeters: number | null = null;
      let proximity = 0;
      let nameWeight = 1;
      if (
        target.latitude !== null &&
        target.longitude !== null &&
        candidate.latitude !== null &&
        candidate.longitude !== null
      ) {
        distanceMeters = haversineMeters(
          { latitude: target.latitude, longitude: target.longitude },
          { latitude: candidate.latitude, longitude: candidate.longitude },
        );
        proximity = Math.max(0, 1 - distanceMeters / MAX_PROXIMITY_M);
        nameWeight = 0.7;
      }
      const score = name * nameWeight + proximity * (1 - nameWeight);
      return { ...candidate, score, distanceMeters };
    })
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id),
    );
}
