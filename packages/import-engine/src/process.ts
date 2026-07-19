import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { assertRequiredHeaders } from "./csv-schema";
import type { RowRejection } from "./rejection";
import {
  validateRow,
  type ImportValidationContext,
  type ParsedImportRow,
} from "./validate";

export interface ImportMetrics {
  total: number;
  accepted: number;
  rejected: number;
  duplicates: number;
}

export interface ImportOutcome {
  accepted: ParsedImportRow[];
  rejections: RowRejection[];
  duplicateCount: number;
  metrics: ImportMetrics;
}

/** Deterministic checksum of the raw file bytes, for import idempotency. */
export function fileChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Parse CSV text into header-keyed row objects. */
export function parseCsv(content: string): Record<string, string>[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
}

function rowSignature(raw: Record<string, string>): string {
  return Object.keys(raw)
    .sort()
    .map((key) => `${key}=${raw[key] ?? ""}`)
    .join("");
}

/**
 * Validate, deduplicate and aggregate parsed rows. Duplicate `(source_key,
 * external_id)` within a file is handled deterministically: an identical repeat
 * is counted as a duplicate (not re-imported); a conflicting repeat is rejected
 * (06_ACCEPTANCE_TESTS IMP-04).
 */
export function processRows(
  rawRows: Record<string, string>[],
  ctx: ImportValidationContext,
): ImportOutcome {
  const accepted: ParsedImportRow[] = [];
  const rejections: RowRejection[] = [];
  let duplicateCount = 0;
  const seen = new Map<string, string>();

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const { row, rejections: rowRejections } = validateRow(raw, rowNumber, ctx);
    if (!row) {
      rejections.push(...rowRejections);
      return;
    }

    const key = `${row.sourceKey}${row.externalId}`;
    const signature = rowSignature(raw);
    const priorSignature = seen.get(key);
    if (priorSignature !== undefined) {
      if (priorSignature === signature) {
        duplicateCount += 1;
      } else {
        rejections.push({
          rowNumber,
          code: "duplicate_conflict",
          message: `conflicting duplicate for (${row.sourceKey}, ${row.externalId})`,
        });
      }
      return;
    }

    seen.set(key, signature);
    accepted.push(row);
  });

  return {
    accepted,
    rejections,
    duplicateCount,
    metrics: {
      total: rawRows.length,
      accepted: accepted.length,
      rejected: rejections.length,
      duplicates: duplicateCount,
    },
  };
}

/** Parse + validate a whole CSV file. Throws if required headers are missing. */
export function runImport(
  content: string,
  ctx: ImportValidationContext,
): ImportOutcome {
  const rows = parseCsv(content);
  const headers = rows.length > 0 ? Object.keys(rows[0] as object) : [];
  assertRequiredHeaders(headers);
  return processRows(rows, ctx);
}
