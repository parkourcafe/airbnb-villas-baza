import { ValidationError } from "@bai/domain";

/**
 * Keyset (cursor) pagination helpers. Large lists must never use OFFSET; they
 * page on a stable sort key. Cursors are opaque, URL-safe base64 payloads so the
 * client cannot craft an out-of-band ordering.
 */
export interface Keyset {
  /** Value of the primary sort column of the last row on the page. */
  sortValue: string;
  /** Tie-breaker id (usually the row uuid) to guarantee a total order. */
  id: string;
}

export function encodeCursor(keyset: Keyset): string {
  const json = JSON.stringify(keyset);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): Keyset {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw new ValidationError("cursor is not valid base64url json");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).sortValue !== "string" ||
    typeof (parsed as Record<string, unknown>).id !== "string"
  ) {
    throw new ValidationError("cursor payload is malformed");
  }
  const record = parsed as { sortValue: string; id: string };
  return { sortValue: record.sortValue, id: record.id };
}

export interface PageRequest {
  /** Requested page size; clamped to [1, maxLimit]. */
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
}

export interface ResolvedPageRequest {
  limit: number;
  after: Keyset | null;
}

export function resolvePageRequest(
  request: PageRequest,
  { defaultLimit = 25, maxLimit = 100 } = {},
): ResolvedPageRequest {
  const requested = request.limit ?? defaultLimit;
  const limit = Math.min(Math.max(1, Math.trunc(requested)), maxLimit);
  return {
    limit,
    after: request.cursor ? decodeCursor(request.cursor) : null,
  };
}
