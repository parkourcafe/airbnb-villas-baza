import { createHash } from "node:crypto";

/**
 * Deterministic text normalization used before hashing noisy fields
 * (title/description/amenities). See 02_SYSTEM_ARCHITECTURE section 10.2.
 *
 * Steps: Unicode NFC normalize, trim, and collapse internal whitespace runs to a
 * single space. Case is preserved here; callers lower-case only where case is
 * not meaningful. Timestamps and session data must never be passed in.
 */
export function normalizeText(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Stable SHA-256 hex hash of already-normalized content. Returned as lower-case
 * hex so fingerprints are reproducible across runs and machines.
 */
export function contentHash(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Convenience: normalize then hash. */
export function normalizedHash(input: string): string {
  return contentHash(normalizeText(input));
}
